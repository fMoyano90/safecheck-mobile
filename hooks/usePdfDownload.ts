import { useState } from 'react';
import { pdfApi } from '@/lib/api';

export const usePdfDownload = () => {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadPdf = async (activityId: string) => {
    if (isDownloading) return;
    
    setIsDownloading(true);
    try {
      await pdfApi.downloadActivityPdf(activityId);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    downloadPdf,
    isDownloading,
  };
};