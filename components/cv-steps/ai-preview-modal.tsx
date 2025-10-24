'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

type ChangeSection = {
  id: string;
  label: string;
  before: string | string[];
  after: string | string[];
  selected: boolean;
};

interface AIPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentData: any;
  suggestedData: any;
  onApply: (selectedSections: string[]) => void;
  isApplying?: boolean;
}

export function AIPreviewModal({
  open,
  onOpenChange,
  currentData,
  suggestedData,
  onApply,
  isApplying = false,
}: AIPreviewModalProps) {
  const [sections, setSections] = useState<ChangeSection[]>(() => buildChangeSections(currentData, suggestedData));

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };

  const selectAll = () => {
    setSections(prev => prev.map(s => ({ ...s, selected: true })));
  };

  const deselectAll = () => {
    setSections(prev => prev.map(s => ({ ...s, selected: false })));
  };

  const handleApply = () => {
    const selected = sections.filter(s => s.selected).map(s => s.id);
    onApply(selected);
  };

  const selectedCount = sections.filter(s => s.selected).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ✨ AI Improvements Preview
            <Badge variant="secondary">{selectedCount} selected</Badge>
          </DialogTitle>
          <DialogDescription>
            Review AI suggestions and choose which changes to apply. Changes are highlighted in green.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={selectAll}>Select All</Button>
          <Button size="sm" variant="outline" onClick={deselectAll}>Deselect All</Button>
        </div>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6">
            {sections.map((section) => (
              <div key={section.id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-start gap-3 mb-3">
                  <Checkbox
                    id={section.id}
                    checked={section.selected}
                    onCheckedChange={() => toggleSection(section.id)}
                  />
                  <label
                    htmlFor={section.id}
                    className="text-sm font-semibold cursor-pointer flex-1"
                  >
                    {section.label}
                  </label>
                  {section.selected ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">Current</div>
                    <div className="text-sm bg-muted/50 rounded p-3 min-h-[60px]">
                      {Array.isArray(section.before) ? (
                        <ul className="space-y-1 list-disc list-inside">
                          {section.before.map((item, idx) => (
                            <li key={idx} className="text-muted-foreground">{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">{section.before || <span className="italic">Empty</span>}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      AI Improved
                    </div>
                    <div className="text-sm bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded p-3 min-h-[60px]">
                      {Array.isArray(section.after) ? (
                        <ul className="space-y-1 list-disc list-inside">
                          {section.after.map((item, idx) => (
                            <li key={idx} className="text-green-900 dark:text-green-100">{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-green-900 dark:text-green-100">{section.after}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={selectedCount === 0 || isApplying}>
            {isApplying ? 'Applying...' : `Apply ${selectedCount} Change${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildChangeSections(current: any, suggested: any): ChangeSection[] {
  const sections: ChangeSection[] = [];

  // Summary
  const currentSummary = (current?.summary || '').trim();
  const suggestedSummary = (suggested?.summary || '').trim();
  if (currentSummary !== suggestedSummary && suggestedSummary) {
    sections.push({
      id: 'summary',
      label: 'Professional Summary',
      before: currentSummary || 'Empty',
      after: suggestedSummary,
      selected: true,
    });
  }

  // Experience bullets
  const currentExp = Array.isArray(current?.experience) ? current.experience : [];
  const suggestedExp = Array.isArray(suggested?.experience) ? suggested.experience : [];
  currentExp.forEach((exp: any, idx: number) => {
    const sugExp = suggestedExp[idx];
    if (!sugExp) return;
    
    const currentBullets = Array.isArray(exp?.bullets) ? exp.bullets : [];
    const suggestedBullets = Array.isArray(sugExp?.bullets) ? sugExp.bullets : [];
    
    if (JSON.stringify(currentBullets) !== JSON.stringify(suggestedBullets) && suggestedBullets.length > 0) {
      sections.push({
        id: `experience-${idx}`,
        label: `${exp?.position || 'Role'} at ${exp?.company || 'Company'}`,
        before: currentBullets,
        after: suggestedBullets,
        selected: true,
      });
    }
  });

  // Project bullets
  const currentProj = Array.isArray(current?.projects) ? current.projects : [];
  const suggestedProj = Array.isArray(suggested?.projects) ? suggested.projects : [];
  currentProj.forEach((proj: any, idx: number) => {
    const sugProj = suggestedProj[idx];
    if (!sugProj) return;
    
    const currentBullets = Array.isArray(proj?.bullets) ? proj.bullets : [];
    const suggestedBullets = Array.isArray(sugProj?.bullets) ? sugProj.bullets : [];
    
    if (JSON.stringify(currentBullets) !== JSON.stringify(suggestedBullets) && suggestedBullets.length > 0) {
      sections.push({
        id: `project-${idx}`,
        label: `Project: ${proj?.name || 'Unnamed'}`,
        before: currentBullets,
        after: suggestedBullets,
        selected: true,
      });
    }
  });

  return sections;
}
