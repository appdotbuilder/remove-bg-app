import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { ImageJob, UploadFileResponse } from '../../server/src/schema';

function App() {
  const [imageJobs, setImageJobs] = useState<ImageJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all image jobs
  const loadImageJobs = useCallback(async () => {
    try {
      const jobs = await trpc.getImageJobs.query();
      setImageJobs(jobs);
    } catch (error) {
      console.error('Failed to load image jobs:', error);
    }
  }, []);

  // Load jobs on component mount
  useEffect(() => {
    loadImageJobs();
  }, [loadImageJobs]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
        alert('Please select a valid image file (JPEG, PNG, or WebP)');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Handle image upload and processing
  const handleUploadAndProcess = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Upload file
      setUploadProgress(25);
      const base64Data = await fileToBase64(selectedFile);
      
      const uploadResponse: UploadFileResponse = await trpc.uploadFile.mutate({
        filename: selectedFile.name,
        file_data: base64Data,
        mime_type: selectedFile.type,
      });

      setUploadProgress(50);

      // Step 2: Create image processing job
      const imageJob = await trpc.createImageJob.mutate({
        original_filename: selectedFile.name,
        original_file_url: uploadResponse.file_url,
        file_size_original: uploadResponse.file_size,
      });

      setUploadProgress(75);

      // Step 3: Start background removal
      setIsProcessing(true);
      const processedJob = await trpc.removeBackground.mutate({
        image_job_id: imageJob.id,
      });

      setUploadProgress(100);

      // Step 4: Update the jobs list with the processed job
      setImageJobs(prev => [processedJob, ...prev.filter(j => j.id !== processedJob.id)]);

      // Reset form
      setSelectedFile(null);
      setPreviewUrl('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // No need to poll since processing completes immediately in our simulation

    } catch (error) {
      console.error('Upload and processing failed:', error);
      alert('Failed to upload and process image. Please try again.');
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress(0);
    }
  };



  // Get status color
  const getStatusColor = (status: ImageJob['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'processing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎨 Background Remover
          </h1>
          <p className="text-gray-600">
            Upload your images and remove backgrounds instantly with AI
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-8 border-2 border-dashed border-purple-200 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📤 Upload Image
            </CardTitle>
            <CardDescription>
              Select an image file (JPEG, PNG, or WebP) to remove its background
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />

              {selectedFile && previewUrl && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="max-w-xs max-h-64 rounded-lg shadow-md object-contain"
                    />
                  </div>
                  <div className="text-sm text-gray-600 text-center">
                    <p><strong>File:</strong> {selectedFile.name}</p>
                    <p><strong>Size:</strong> {formatFileSize(selectedFile.size)}</p>
                    <p><strong>Type:</strong> {selectedFile.type}</p>
                  </div>
                </div>
              )}

              {(isUploading || isProcessing) && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-center text-gray-600">
                    {isUploading ? 'Uploading and processing...' : 'Processing image...'}
                  </p>
                </div>
              )}

              <Button
                onClick={handleUploadAndProcess}
                disabled={!selectedFile || isUploading || isProcessing}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isUploading ? '⏳ Uploading...' : isProcessing ? '🎨 Processing...' : '🚀 Remove Background'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">📋 Processing History</h2>
            <Button
              onClick={loadImageJobs}
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              🔄 Refresh
            </Button>
          </div>

          {imageJobs.length === 0 ? (
            <Alert>
              <AlertDescription>
                No images processed yet. Upload an image above to get started! 🎯
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4">
              {imageJobs.map((job: ImageJob) => (
                <Card key={job.id} className="bg-white/80 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">
                          📁 {job.original_filename}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${getStatusColor(job.status)} text-white`}>
                            {job.status.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            ID: {job.id}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>🕐 {job.created_at.toLocaleDateString()} {job.created_at.toLocaleTimeString()}</p>
                        {job.completed_at && (
                          <p>✅ {job.completed_at.toLocaleDateString()} {job.completed_at.toLocaleTimeString()}</p>
                        )}
                      </div>
                    </div>

                    {job.error_message && (
                      <Alert className="mb-4 border-red-200 bg-red-50">
                        <AlertDescription className="text-red-700">
                          ❌ {job.error_message}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Original Image */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-700">📷 Original Image</h4>
                        <div className="bg-gray-100 rounded-lg p-4 text-center">
                          <p className="text-sm text-gray-600 mb-2">
                            💾 Size: {formatFileSize(job.file_size_original)}
                          </p>
                          {/* In a real app, you would display the actual image */}
                          <div className="bg-white rounded border-2 border-dashed border-gray-300 h-32 flex items-center justify-center">
                            <span className="text-gray-400">🖼️ Original Image</span>
                          </div>
                        </div>
                      </div>

                      {/* Processed Image */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-700">✨ Processed Image</h4>
                        {job.status === 'completed' && job.processed_file_url ? (
                          <div className="bg-gray-100 rounded-lg p-4 text-center">
                            <p className="text-sm text-gray-600 mb-2">
                              💾 Size: {job.file_size_processed ? formatFileSize(job.file_size_processed) : 'Unknown'}
                            </p>
                            {/* In a real app, you would display the actual processed image */}
                            <div className="bg-white rounded border-2 border-dashed border-green-300 h-32 flex items-center justify-center">
                              <span className="text-green-600">🎨 Background Removed</span>
                            </div>
                            <Button
                              className="mt-2 bg-green-500 hover:bg-green-600"
                              size="sm"
                            >
                              💾 Download
                            </Button>
                          </div>
                        ) : job.status === 'processing' ? (
                          <div className="bg-blue-50 rounded-lg p-4 text-center">
                            <div className="h-32 flex items-center justify-center">
                              <div className="text-blue-600">
                                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                                <span>Processing...</span>
                              </div>
                            </div>
                          </div>
                        ) : job.status === 'failed' ? (
                          <div className="bg-red-50 rounded-lg p-4 text-center">
                            <div className="h-32 flex items-center justify-center">
                              <span className="text-red-600">❌ Processing Failed</span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 rounded-lg p-4 text-center">
                            <div className="h-32 flex items-center justify-center">
                              <span className="text-yellow-600">⏳ Pending</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator className="my-4" />
                    
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>Job created: {job.created_at.toLocaleDateString()}</span>
                      {job.completed_at && (
                        <span>Completed: {job.completed_at.toLocaleDateString()}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;