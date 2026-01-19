"use client";
import { useEffect, useState } from "react";
import { AlertCircle, CircleCheckBig } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { motion, AnimatePresence } from "framer-motion";

interface AlertComponentProps {
    title: string;
    description: string;
    warning?: boolean;
}

export default function AlertComponent(props: AlertComponentProps) {
    const [visible, setVisible] = useState(false);
    const [currentTitle, setCurrentTitle] = useState("");
    const [currentDescription, setCurrentDescription] = useState("");

    useEffect(() => {
        if (props.title && props.description) {
            setCurrentTitle(props.title);
            setCurrentDescription(props.description);
            setVisible(true);

            const timeout = setTimeout(() => {
                setVisible(false);
            }, 5000);

            return () => clearTimeout(timeout);
        }
    }, [props.title, props.description]);

    return (
        <div>
            <AnimatePresence>
                {visible && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Alert
                            {...(props.warning ? { variant: "destructive" } : { className:"bg-[#4CAF50] text-[#f3f3f3]" })}
                        >
                            {props.warning ? (
                                <AlertCircle className="h-4 w-4" />
                            ) : (
                                <CircleCheckBig className="h-4 w-4" color="#f3f3f3" />
                            )}
                            
                            <AlertTitle>{currentTitle}</AlertTitle>
                            <AlertDescription>{currentDescription}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
