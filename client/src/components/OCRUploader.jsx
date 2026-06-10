import { useState, useRef } from "react";
import axios from "axios";

const FIELD_LABELS = {
  studentName:    { label: "Student Name",      icon: "👤" },
  studentId:      { label: "Student ID",         icon: "🪪" },
  program:        { label: "Program / Degree",   icon: "🎓" },
  department:     { label: "Department",         icon: "🏛️" },
  graduationYear: { label: "Graduation Year",    icon: "📅" },
  cgpa:           { label: "CGPA",               icon: "📊" },
  university:     { label: "University",         icon: "🏫" },
};

export default function OCRUploader({ onFieldsExtracted, token }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [editedFields, setEditedFields] = useState({});

  const handleFile = (f) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(f.type)) {
      setError("Please upload a JPG, PNG, WEBP, or PDF file.");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleExtract = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("document", file);

      const { data } = await axios.post("/api/ocr/extract", fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      setResult(data.data);
      setEditedFields(
        Object.fromEntries(
          Object.entries(data.data.fields)
            .filter(([k]) => k !== "confidence")
            .map(([k, v]) => [k, v ?? ""])
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || "OCR failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseFields = () => {
    if (onFieldsExtracted) onFieldsExtracted(editedFields);
  };

  const extractedCount = result
    ? Object.entries(editedFields).filter(([k, v]) => v && v !== "").length
    : 0;

  return (
    <div className="bg-[#111D2C] border border-slate-800 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center text-lg">
          🔍
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">Auto-fill with OCR</h3>
          <p className="text-slate-500 text-xs">Upload your degree/transcript to extract details automatically</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !loading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
          loading ? "opacity-50 cursor-not-allowed" :
          dragOver ? "border-blue-500 bg-blue-500/5" :
          file ? "border-green-500/40 bg-green-500/5" :
          "border-slate-700 hover:border-slate-600"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
        />
        {file ? (
          <div>
            <div className="text-2xl mb-1">{file.type.includes("pdf") ? "📄" : "🖼️"}</div>
            <p className="text-green-400 text-sm font-medium">{file.name}</p>
            <p className="text-slate-500 text-xs mt-0.5">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
          </div>
        ) : (
          <div>
            <div className="text-2xl mb-1">📋</div>
            <p className="text-slate-300 text-sm font-medium">Drop your degree or transcript here</p>
            <p className="text-slate-500 text-xs mt-0.5">JPG, PNG, PDF · Max 10MB</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      {file && !result && (
        <button
          onClick={handleExtract}
          disabled={loading}
          className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 mb-4"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Extracting text… this may take 10–20 seconds
            </>
          ) : (
            <> 🔍 Extract Fields</>
          )}
        </button>
      )}

      {/* Results */}
      {result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-slate-300 text-sm font-medium">
              Extracted {extractedCount} of {Object.keys(FIELD_LABELS).length} fields
            </p>
            <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full">
              {result.processingTimeMs}ms
            </span>
          </div>

          <div className="space-y-2.5 mb-4">
            {Object.entries(FIELD_LABELS).map(([key, { label, icon }]) => (
              <div key={key}>
                <label className="block text-xs text-slate-500 mb-1">{icon} {label}</label>
                <input
                  type="text"
                  value={editedFields[key] ?? ""}
                  onChange={(e) => setEditedFields((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={`${label} not detected`}
                  className={`w-full px-3 py-2 rounded-lg text-sm border transition-all focus:outline-none focus:border-blue-500 ${
                    editedFields[key]
                      ? "bg-green-500/5 border-green-500/30 text-white"
                      : "bg-[#0D1B2A] border-slate-700 text-slate-500 placeholder-slate-600"
                  }`}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleUseFields}
              className="flex-1 py-2.5 bg-green-500 hover:bg-green-400 text-white font-medium rounded-lg text-sm transition-colors"
            >
              ✓ Use These Fields
            </button>
            <button
              onClick={() => { setResult(null); setFile(null); setEditedFields({}); }}
              className="px-4 py-2.5 border border-slate-700 text-slate-400 hover:text-white rounded-lg text-sm transition-all"
            >
              Reset
            </button>
          </div>

          <p className="text-slate-600 text-xs mt-2 text-center">
            You can edit any field above before using
          </p>
        </div>
      )}
    </div>
  );
}
