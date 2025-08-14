import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import { useState, useCallback, useRef } from 'react';
import type { ImageJob, UploadFileResponse } from '../../server/src/schema';

// Status mapping in Indonesian
const statusLabels = {
  pending: { text: 'Menunggu', color: 'bg-yellow-500' },
  processing: { text: 'Memproses', color: 'bg-blue-500' },
  completed: { text: 'Selesai', color: 'bg-green-500' },
  failed: { text: 'Gagal', color: 'bg-red-500' }
} as const;

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<ImageJob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
      setError('Format file tidak didukung. Gunakan JPEG, PNG, atau WebP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Ukuran file terlalu besar. Maksimal 10MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setCurrentJob(null);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Convert file to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]); // Remove data:image/jpeg;base64, prefix
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  // Upload and process image
  const handleUploadAndProcess = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setError(null);

      // Convert file to base64
      const base64Data = await fileToBase64(selectedFile);

      // Upload file
      const uploadResponse: UploadFileResponse = await trpc.uploadFile.mutate({
        filename: selectedFile.name,
        file_data: base64Data,
        mime_type: selectedFile.type as any
      });

      // Create image job
      const job: ImageJob = await trpc.createImageJob.mutate({
        original_filename: selectedFile.name,
        original_file_url: uploadResponse.file_url,
        file_size_original: uploadResponse.file_size
      });

      setCurrentJob(job);
      setIsUploading(false);
      setIsProcessing(true);

      // Start background removal
      const processedJob: ImageJob = await trpc.removeBackground.mutate({
        image_job_id: job.id
      });

      setCurrentJob(processedJob);
      setIsProcessing(false);

    } catch (err) {
      console.error('Error processing image:', err);
      setError('Terjadi kesalahan saat memproses gambar. Silakan coba lagi.');
      setIsUploading(false);
      setIsProcessing(false);
    }
  }, [selectedFile, fileToBase64]);

  // Download processed image
  const handleDownload = useCallback(async () => {
    if (!currentJob?.processed_file_url) return;

    try {
      const response = await fetch(currentJob.processed_file_url);
      const blob = await response.blob();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentJob.original_filename.split('.')[0]}_no_bg.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Gagal mengunduh gambar. Silakan coba lagi.');
    }
  }, [currentJob]);

  // Reset application state
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCurrentJob(null);
    setError(null);
    setIsUploading(false);
    setIsProcessing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            🎨 Background Remover
          </h1>
          <p className="text-gray-600 text-lg">
            Hapus latar belakang gambar dengan mudah dan cepat
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                ⚠️ {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Section */}
          {!currentJob && (
            <Card className="border-2 border-dashed border-gray-300 hover:border-purple-400 transition-colors">
              <CardContent className="p-8">
                <div
                  className="text-center cursor-pointer"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-6xl mb-4">📁</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Pilih atau Seret Gambar
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Didukung: JPEG, PNG, WebP (Maksimal 10MB)
                  </p>
                  <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600">
                    🖼️ Pilih Gambar
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  className="hidden"
                />
              </CardContent>
            </Card>
          )}

          {/* Preview Section */}
          {selectedFile && previewUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Preview Gambar</span>
                  <Badge variant="secondary">
                    {formatFileSize(selectedFile.size)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center mb-4">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-w-full max-h-96 rounded-lg shadow-md"
                  />
                </div>
                <div className="flex justify-center space-x-4">
                  <Button
                    onClick={handleUploadAndProcess}
                    disabled={isUploading || isProcessing}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    {isUploading ? (
                      <>🔄 Mengunggah...</>
                    ) : isProcessing ? (
                      <>⚡ Memproses...</>
                    ) : (
                      <>✨ Hapus Background</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    disabled={isUploading || isProcessing}
                  >
                    🔄 Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Status */}
          {(isUploading || isProcessing) && (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-2xl mb-2">
                      {isUploading ? '📤' : '🎨'}
                    </div>
                    <h3 className="text-lg font-semibold">
                      {isUploading ? 'Mengunggah gambar...' : 'Memproses gambar...'}
                    </h3>
                    <p className="text-gray-600">
                      {isUploading 
                        ? 'Harap tunggu, sedang mengunggah gambar Anda'
                        : 'AI sedang menghapus latar belakang gambar Anda'
                      }
                    </p>
                  </div>
                  <Progress value={isUploading ? 30 : 70} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {currentJob && currentJob.status === 'completed' && currentJob.processed_file_url && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>🎉 Hasil Pemrosesan</span>
                  <Badge className={statusLabels[currentJob.status].color}>
                    {statusLabels[currentJob.status].text}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Original Image */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-center">Gambar Asli</h4>
                    <img
                      src={currentJob.original_file_url}
                      alt="Original"
                      className="w-full rounded-lg shadow-md"
                    />
                    <p className="text-sm text-gray-600 text-center">
                      {formatFileSize(currentJob.file_size_original)}
                    </p>
                  </div>

                  {/* Processed Image */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-center">Tanpa Background</h4>
                    <div className="relative">
                      <img
                        src={currentJob.processed_file_url}
                        alt="Processed"
                        className="w-full rounded-lg shadow-md"
                        style={{
                          background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                          backgroundSize: '20px 20px',
                          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                        }}
                      />
                    </div>
                    {currentJob.file_size_processed && (
                      <p className="text-sm text-gray-600 text-center">
                        {formatFileSize(currentJob.file_size_processed)}
                      </p>
                    )}
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Action Buttons */}
                <div className="flex justify-center space-x-4">
                  <Button
                    onClick={handleDownload}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  >
                    📥 Unduh Hasil
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                  >
                    🔄 Proses Gambar Lain
                  </Button>
                </div>

                {/* Job Info */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h5 className="font-semibold mb-2">📊 Informasi Pemrosesan</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">File:</span> {currentJob.original_filename}
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span> {statusLabels[currentJob.status].text}
                    </div>
                    <div>
                      <span className="text-gray-600">Dibuat:</span> {currentJob.created_at.toLocaleDateString('id-ID')}
                    </div>
                    {currentJob.completed_at && (
                      <div>
                        <span className="text-gray-600">Selesai:</span> {currentJob.completed_at.toLocaleDateString('id-ID')}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed Status */}
          {currentJob && currentJob.status === 'failed' && (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-6xl mb-4">❌</div>
                <h3 className="text-xl font-semibold text-red-600 mb-2">
                  Pemrosesan Gagal
                </h3>
                <p className="text-gray-600 mb-4">
                  {currentJob.error_message || 'Terjadi kesalahan saat memproses gambar'}
                </p>
                <Button
                  onClick={handleReset}
                  variant="outline"
                >
                  🔄 Coba Lagi
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          <p>🚀 Powered by Remove.bg API</p>
        </div>
      </div>
    </div>
  );
}

export default App;