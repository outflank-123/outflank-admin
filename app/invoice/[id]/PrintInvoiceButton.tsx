'use client';

import { Printer } from 'lucide-react';
import { useEffect } from 'react';

export default function PrintInvoiceButton() {
  useEffect(() => {
    const isAutoPrint = new URLSearchParams(window.location.search).get('print');
    if (isAutoPrint === 'true') {
      const timer = setTimeout(() => {
        window.print();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <button 
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-[#1d1d1f] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-black transition-colors cursor-pointer shadow-xs"
    >
      <Printer size={16} />
      <span>Print / Save as PDF</span>
    </button>
  );
}
