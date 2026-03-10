"use client";

import { Check } from "lucide-react";

interface WizardStepperProps {
    currentStep: number;
    steps: { label: string }[];
    onStepClick?: (step: number) => void;
}

export function WizardStepper({ currentStep, steps, onStepClick }: WizardStepperProps) {
    return (
        <div className="flex items-center justify-center w-full mb-8">
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isActive = index === currentStep;
                const isFuture = index > currentStep;

                return (
                    <div key={step.label} className="flex items-center">
                        <button
                            type="button"
                            onClick={() => isCompleted && onStepClick?.(index)}
                            disabled={!isCompleted}
                            className={`
                                flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold
                                transition-all duration-200
                                ${isCompleted
                                    ? "bg-green-600 text-white cursor-pointer hover:bg-green-500"
                                    : isActive
                                        ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-900"
                                        : "bg-slate-700 text-slate-400 cursor-default"
                                }
                            `}
                        >
                            {isCompleted ? (
                                <Check className="w-5 h-5" />
                            ) : (
                                index + 1
                            )}
                        </button>
                        <span
                            className={`
                                ml-2 text-sm font-medium hidden sm:inline
                                ${isActive
                                    ? "text-yellow-400"
                                    : isCompleted
                                        ? "text-green-400"
                                        : "text-slate-500"
                                }
                            `}
                        >
                            {step.label}
                        </span>
                        {index < steps.length - 1 && (
                            <div
                                className={`
                                    w-12 md:w-20 h-0.5 mx-3
                                    ${isFuture ? "bg-slate-700" : "bg-gradient-to-r from-green-600 to-yellow-500"}
                                `}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
