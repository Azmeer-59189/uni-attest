"""Exercise validation without downloading biometric models or requiring a GPU."""
import importlib.util
import sys
import types
import unittest
from unittest.mock import MagicMock, patch


class FaceValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        modules = {name: MagicMock() for name in ['cv2', 'numpy', 'deepface', 'flask_cors']}
        # Flask may be absent on machines that only run the Node application.
        flask = types.ModuleType('flask')
        app = MagicMock()
        app.route = lambda *args, **kwargs: lambda function: function
        flask.Flask = lambda name: app
        flask.jsonify = lambda payload: payload
        flask.request = MagicMock()
        modules['flask'] = flask
        with patch.dict(sys.modules, modules):
            spec = importlib.util.spec_from_file_location('face_validation_subject', 'face_service.py')
            cls.service = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.service)

    def test_no_face_and_multiple_faces_are_rejected(self):
        for faces in [[], [{}, {}]]:
            self.service.DeepFace.extract_faces.return_value = faces
            self.assertFalse(self.service.detect_face('image.jpg')[0])
        self.service.DeepFace.extract_faces.return_value = [{}]
        self.assertTrue(self.service.detect_face('image.jpg')[0])
        self.assertTrue(self.service.DeepFace.extract_faces.call_args.kwargs['enforce_detection'])

    def test_id_photo_with_several_faces_compares_the_largest(self):
        faces = [{'facial_area': {'x': 0, 'y': 0, 'w': 10, 'h': 10}}, {'facial_area': {'x': 50, 'y': 50, 'w': 80, 'h': 90}}]
        self.service.DeepFace.extract_faces.return_value = faces
        with patch.object(self.service, 'crop_largest_face', return_value='largest.jpg') as crop:
            self.assertEqual(self.service.detect_face('id.jpg', use_largest=True), (True, 'largest.jpg'))
        crop.assert_called_once_with('id.jpg', faces)
        self.assertFalse(self.service.detect_face('selfie.jpg')[0])

    def test_detection_failure_is_rejected(self):
        with patch.object(self.service.DeepFace, 'extract_faces', side_effect=ValueError('No face')):
            self.assertFalse(self.service.detect_face('image.jpg')[0])

    def test_dark_image_returns_a_clear_client_error(self):
        service = self.service
        service.request.content_type = 'application/json'
        service.request.get_json.return_value = {'id_photo': 'a', 'selfie': 'b'}
        with patch.object(service, 'save_base64_image', return_value='missing-test-image.jpg'), \
             patch.object(service, 'detect_face', return_value=(True, 'missing-test-image.jpg')), \
             patch.object(service.cv2, 'imread', return_value=object()), \
             patch.object(service.np, 'mean', return_value=0):
            payload, status = service.verify_face()
        self.assertEqual(status, 400)
        self.assertFalse(payload['match'])
        self.assertIn('too dark', payload['error'])

    def test_face_comparison_requires_detection_and_uses_model_threshold(self):
        service = self.service
        with patch.object(service.cv2, 'imread', return_value=object()), \
             patch.object(service.np, 'mean', return_value=100), \
             patch.object(service.DeepFace, 'verify', return_value={'distance': 0.45, 'threshold': 0.4}) as verify:
            result = service.verify_faces('id.jpg', 'selfie.jpg')
        self.assertFalse(result['match'])
        self.assertTrue(verify.call_args.kwargs['enforce_detection'])


if __name__ == '__main__':
    unittest.main()
