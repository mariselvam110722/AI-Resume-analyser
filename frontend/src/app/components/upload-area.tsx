import React, { useState, useRef } from "react";
import { Card, CardContent } from "./ui/card";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "./ui/button";
import { uploadResume } from "../../api";

interface UploadAreaProps {
  onResult: (data: any) => void;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ onResult }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setLoading(true);
    const username = localStorage.getItem("user");

    try {
      const data = await uploadResume(file, username);
      onResult(data);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        uploadFile(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      uploadFile(file);
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleRemove = () => {
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-950/20"
              : "border-slate-700 hover:border-slate-600"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="flex items-center justify-center gap-4">
              <FileText className="w-8 h-8 text-blue-500" />
              <div className="text-left flex-1">
                <p className="text-slate-200 font-medium">{selectedFile.name}</p>
                <p className="text-slate-500 text-sm">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
                {loading && (
                  <p className="text-blue-400 text-sm mt-1">
                    Analyzing resume...
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-slate-400 hover:text-red-400 hover:bg-red-950"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-300 mb-2">
                Drag and drop your resume here
              </p>
              <p className="text-slate-500 text-sm mb-4">or</p>
              <Button
                onClick={handleButtonClick}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Browse Files
              </Button>
              <p className="text-slate-600 text-xs mt-4">PDF files only</p>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            onChange={handleChange}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};