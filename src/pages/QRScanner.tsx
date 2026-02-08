import { useState, useRef } from "react";
import { QrCode, Camera, X } from "lucide-react";
import { motion } from "motion/react";

export default function QRScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Unable to access camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // Simulate QR code scan (in a real app, you'd use a QR code library)
  const simulateScan = () => {
    setScannedData("https://example.com/scanned-qr-code");
    stopScanning();
  };

  return (
    <div className="bg-white relative size-full overflow-hidden flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-6"
      >
        <div className="bg-white rounded-2xl p-8">
          <div className="flex items-center justify-center mb-12">
            <QrCode className="w-16 h-16 text-black" strokeWidth={1.5} />
          </div>

          {!isScanning && !scannedData && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startScanning}
              className="w-full bg-black text-white py-5 rounded-2xl font-medium flex items-center justify-center gap-2 shadow-lg hover:bg-gray-900 transition-colors text-lg"
            >
              <Camera className="w-6 h-6" />
              who are you?
            </motion.button>
          )}

          {isScanning && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-xl overflow-hidden aspect-square">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-white rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-black rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-black rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-black rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-black rounded-br-lg" />
                    
                    {/* Animated scanning line */}
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-black"
                      animate={{
                        top: ["0%", "100%"],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={stopScanning}
                  className="flex-1 bg-white border-2 border-black text-black py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={simulateScan}
                  className="flex-1 bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-900 transition-colors"
                >
                  Simulate Scan
                </motion.button>
              </div>
            </div>
          )}

          {scannedData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="bg-white border-2 border-black rounded-xl p-6 text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  </div>
                </div>
                <h3 className="font-semibold text-black mb-2">
                  QR Code Scanned!
                </h3>
                <p className="text-sm text-gray-700 break-all">
                  {scannedData}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setScannedData(null)}
                className="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-900 transition-colors"
              >
                Scan Another
              </motion.button>
            </motion.div>
          )}
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Point your camera at a QR code to scan
        </p>
      </motion.div>
    </div>
  );
}