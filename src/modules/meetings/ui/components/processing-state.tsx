import React from "react";
import { Loader2, Sparkles } from "lucide-react";

export const ProcessingState = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
        <div className="relative bg-blue-50 p-4 rounded-full">
          <Sparkles className="size-10 text-blue-600 animate-pulse" />
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating AI Insights</h2>
      <p className="text-gray-500 max-w-sm mb-8 leading-relaxed">
        Lumina is processing your meeting transcript to generate a summary, personalized quiz, and recommended learning path.
      </p>
      
      <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 rounded-full border border-gray-100">
        <Loader2 className="size-5 text-blue-600 animate-spin" />
        <span className="text-sm font-medium text-gray-600">This usually takes about 10-15 seconds...</span>
      </div>
    </div>
  );
};
