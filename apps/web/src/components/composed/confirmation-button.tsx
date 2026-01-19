import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../ui/alert-dialog";
import { Button } from "../ui/button";

interface ConfirmationButtonProps {
    buttonText: string;
    title: string;
    description: string;
    confirmButtonText: string;
    cancelButtonText: string;
    onConfirm: () => void;
    warning?: boolean;
}

export default function ConfirmationButton(props: ConfirmationButtonProps) {
    return (
        <div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button
                        {...(props.warning && { variant: "destructive" })}
                        onClick={props.onConfirm}
                    >
                        {props.buttonText}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-black">{props.title}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {props.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{props.cancelButtonText}</AlertDialogCancel>
                        <AlertDialogAction {...(props.warning && { className: "bg-red-600" })} >{props.confirmButtonText}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
