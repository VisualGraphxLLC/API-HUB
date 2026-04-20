"use client";

import { PipelineView } from "@/components/workflows/pipeline-view";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>Data Pipeline</h1>
        <p className="text-sm mt-1" style={{ color: "var(--ink-muted)" }}>
          How products flow from suppliers to your storefronts
        </p>
      </div>

      <Separator />

      {/* Visualizer */}
      <div>
        <PipelineView />
      </div>

      {/* Info panel + n8n launcher */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Orchestration Engine</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Sync schedules are managed securely within our automation engine (n8n). The pipeline runs automatically once you activate a supplier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            className="font-semibold bg-[#1e4d92] hover:bg-[#143566]"
            onClick={() => window.open("http://localhost:5678", "_blank")}
          >
            Open Automation Editor ↗
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
