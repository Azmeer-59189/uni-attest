import os
os.environ['DEEPFACE_HOME'] = os.path.expanduser('~')

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import cv2
import numpy as np
from ultralytics import YOLO
from deepface import DeepFace
import base64
import re

app = Flask(__name__)
CORS(app)

# Load YOLOv8 face detection model (downloads automatically on first run)
print("Loading YOLO model...")
model = YOLO("yolov8n.pt")  # nano model — fast and lightweight
print("YOLO model loaded.")

def save_base64_image(b64_string, suffix=".jpg"):
    """Save a base64 image to a temp file and return the path."""
    # Strip data URL prefix if present (e.g. data:image/jpeg;base64,...)
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    img_bytes = base64.b64decode(b64_string)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(img_bytes)
    tmp.close()
    return tmp.name

def save_uploaded_file(file, suffix=".jpg"):
    """Save an uploaded file to a temp file and return the path."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    file.save(tmp.name)
    tmp.close()
    return tmp.name

def detect_face_yolo(image_path):
    """
    Use YOLO to detect faces in an image.
    Returns True if at least one face is detected, False otherwise.
    Also returns the cropped face image path for better DeepFace matching.
    """
    results = model(image_path, classes=[0], verbose=False)  # class 0 = person
    
    # Read image
    img = cv2.imread(image_path)
    if img is None:
        return False, None
    
    # Try to find face using YOLO person detection + face crop
    detections = results[0].boxes
    if detections is None or len(detections) == 0:
        # No person detected — still try DeepFace directly
        return True, image_path
    
    # Get the largest bounding box (most prominent person)
    best_box = None
    best_area = 0
    for box in detections.xyxy:
        x1, y1, x2, y2 = map(int, box)
        area = (x2 - x1) * (y2 - y1)
        if area > best_area:
            best_area = area
            best_box = (x1, y1, x2, y2)
    
    if best_box:
        x1, y1, x2, y2 = best_box
        # Crop to upper portion (face area) of the detected person
        face_height = int((y2 - y1) * 0.4)
        face_crop = img[y1:y1 + face_height, x1:x2]
        if face_crop.size > 0:
            crop_path = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg").name
            cv2.imwrite(crop_path, face_crop)
            return True, crop_path
    
    return True, image_path

def verify_faces(id_photo_path, selfie_path):
    try:
        img1 = cv2.imread(id_photo_path)
        img2 = cv2.imread(selfie_path)

        if img1 is None:
            return {"match": False, "error": "Could not read ID photo"}
        if img2 is None:
            return {"match": False, "error": "Could not read selfie"}

        # Reject black images
        if np.mean(img2) < 25:
            return {"match": False, "error": "Selfie is too dark. Please take photo in better lighting."}
        if np.mean(img1) < 25:
            return {"match": False, "error": "ID photo is too dark. Please upload a clearer photo."}

        result = DeepFace.verify(
            img1_path=id_photo_path,
            img2_path=selfie_path,
            model_name="Facenet",
            detector_backend="opencv",
            enforce_detection=False,
            distance_metric="cosine"
        )

        distance = result["distance"]
        threshold = result["threshold"]

        # Use a slightly relaxed threshold for ID cards
        adjusted_threshold = threshold * 1.2
        match = distance <= adjusted_threshold

        return {
            "match": match,
            "distance": round(distance, 4),
            "threshold": round(adjusted_threshold, 4),
            "confidence": round(max(0, (1 - distance) * 100), 1)
        }
    except Exception as e:
        print(f"DeepFace error: {e}")
        return {"match": False, "distance": 1.0, "threshold": 0.4, "confidence": 0.0, "error": str(e)}

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "face-verification"})

@app.route("/verify-face", methods=["POST"])
def verify_face():
    id_photo_path = None
    selfie_path = None
    cropped_id_path = None
    cropped_selfie_path = None

    try:
        # Accept either multipart files or base64 JSON
        if request.content_type and "multipart" in request.content_type:
            # Multipart form data
            if "id_photo" not in request.files or "selfie" not in request.files:
                return jsonify({"error": "Both id_photo and selfie are required"}), 400

            id_file = request.files["id_photo"]
            selfie_file = request.files["selfie"]

            id_ext = os.path.splitext(id_file.filename)[1] or ".jpg"
            selfie_ext = os.path.splitext(selfie_file.filename)[1] or ".jpg"

            id_photo_path = save_uploaded_file(id_file, id_ext)
            selfie_path = save_uploaded_file(selfie_file, selfie_ext)
        else:
            # JSON with base64
            data = request.get_json()
            if not data or "id_photo" not in data or "selfie" not in data:
                return jsonify({"error": "Both id_photo and selfie are required"}), 400

            id_photo_path = save_base64_image(data["id_photo"])
            selfie_path = save_base64_image(data["selfie"])

        # Step 1 — YOLO face detection on both images
        id_face_found, cropped_id_path = detect_face_yolo(id_photo_path)
        selfie_face_found, cropped_selfie_path = detect_face_yolo(selfie_path)

        if not id_face_found:
            return jsonify({
                "match": False,
                "error": "No face detected in ID photo. Please upload a clear photo of your ID."
            }), 400

        if not selfie_face_found:
            return jsonify({
                "match": False,
                "error": "No face detected in selfie. Please take a clear selfie."
            }), 400

        # Step 2 — DeepFace verification
        use_id = cropped_id_path if cropped_id_path else id_photo_path
        use_selfie = cropped_selfie_path if cropped_selfie_path else selfie_path

        verification = verify_faces(use_id, use_selfie)

        return jsonify({
            "success": True,
            "match": verification["match"],
            "confidence": verification["confidence"],
            "distance": verification["distance"],
            "threshold": verification["threshold"],
            "message": "Face verified successfully" if verification["match"] else "Faces do not match"
        })

    except Exception as e:
        print(f"Error in verify_face: {e}")
        return jsonify({"error": "Face verification failed", "details": str(e)}), 500

    finally:
        # Clean up all temp files
        for path in [id_photo_path, selfie_path, cropped_id_path, cropped_selfie_path]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except:
                    pass

if __name__ == "__main__":
    print("Starting face verification service on port 5001...")
    app.run(host="0.0.0.0", port=5001, debug=False)