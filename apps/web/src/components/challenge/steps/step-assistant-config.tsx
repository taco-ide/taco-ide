"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { personalityTypes } from "@/components/challenge/constants";

export function StepAssistantConfig() {
    return (
        <Card className="p-6 bg-slate-800 border-slate-700">
            <div className="space-y-4">
                <div>
                    <Label className="text-slate-200">Reference Material (PDF)</Label>
                    <Input
                        type="file"
                        accept=".pdf"
                        className="bg-slate-900 border-slate-700 text-slate-200"
                    />
                </div>

                <div>
                    <Label className="text-slate-200">Assistant Personality</Label>
                    <Select>
                        <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                            <SelectValue placeholder="Select personality" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                            {personalityTypes.map((personality) => (
                                <SelectItem
                                    key={personality.id}
                                    value={personality.id}
                                    className="text-slate-200 focus:bg-slate-700"
                                >
                                    <div>
                                        <div className="font-medium">{personality.name}</div>
                                        <div className="text-xs text-slate-400">{personality.description}</div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </Card>
    );
}
