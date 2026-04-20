import React from "react";
import { Store, Download, Wand2, Database, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type NodeStatus = "idle" | "running" | "done" | "error";

interface PipelineNodeProps {
  label: string;
  icon: React.ReactNode;
  status: NodeStatus;
  isLast?: boolean;
}

function PipelineNode({ label, icon, status, isLast }: PipelineNodeProps) {
  const isRunning = status === "running";
  
  const getBadgeStyle = () => {
    switch (status) {
      case "idle": return "bg-gray-100 text-gray-500 hover:bg-gray-100";
      case "running": return "bg-blue-100 text-blue-700 hover:bg-blue-200 animate-pulse";
      case "done": return "bg-green-100 text-green-700 hover:bg-green-200";
      case "error": return "bg-red-100 text-red-700 hover:bg-red-200";
    }
  };

  const getLabel = () => {
    switch (status) {
      case "idle": return "Idle";
      case "running": return "Running";
      case "done": return "Done";
      case "error": return "Error";
    }
  };

  return (
    <div className="flex items-center">
      <div 
        className={`flex flex-col items-center justify-center p-4 w-40 min-h-32 border-2 rounded-xl bg-card shadow-sm transition-all duration-300 ${isRunning ? 'border-blue-500 shadow-md transform -translate-y-1' : 'border-border'}`}
        style={isRunning ? { animation: "pulseNode 2s infinite" } : undefined}
      >
        <div className={`mb-3 p-2 rounded-full ${isRunning ? 'bg-blue-50 text-blue-600' : 'bg-muted text-muted-foreground'}`}>
          {icon}
        </div>
        <span className="text-sm font-bold text-center leading-tight mb-2 tracking-tight">
          {label}
        </span>
        <Badge className={`text-[10px] uppercase font-mono px-2 py-0.5 mt-auto ${getBadgeStyle()}`} variant="secondary">
          {getLabel()}
        </Badge>
      </div>

      {!isLast && (
        <div className="mx-2 flex items-center h-full">
          <div className="h-[3px] bg-muted w-10 relative overflow-hidden rounded-full">
             {status === "done" && (
                <div 
                  className="absolute top-0 left-0 h-full bg-green-400" 
                  style={{ animation: "drawLine 1s forwards" }}
                />
             )}
             {status === "running" && (
                <div 
                  className="absolute top-0 left-0 h-full bg-blue-400 opacity-50 w-full"
                  style={{ animation: "pulseNode 1.5s infinite" }}
                />
             )}
          </div>
          <div className={`w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] border-l-muted ml-[-2px] ${(status === "done" || status === "running") ? "hidden" : "block"}`}></div>
          {(status === "done" || status === "running") && (
            <div className={`w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[6px] ${status === "done" ? 'border-l-green-400' : 'border-l-blue-400 opacity-50'} ml-[-2px]`}></div>
          )}
        </div>
      )}
    </div>
  );
}

export function PipelineView() {
  return (
    <div className="flex items-center justify-center py-12 px-4 rounded-xl border border-dashed border-border bg-gray-50/50">
      <PipelineNode label="Supplier" icon={<Store size={22} />} status="idle" />
      <PipelineNode label="Fetch Data" icon={<Download size={22} />} status="idle" />
      <PipelineNode label="Normalize" icon={<Wand2 size={22} />} status="idle" />
      <PipelineNode label="Store in DB" icon={<Database size={22} />} status="idle" />
      <PipelineNode label="Publish to Store" icon={<UploadCloud size={22} />} status="idle" isLast={true} />
    </div>
  );
}
