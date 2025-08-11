import { CheckCircle, Hourglass, XCircle } from "lucide-react";

export const getStatusStyle = (status: string) => {
  switch (status) {
    case "approve":
      return {
        bg: "bg-lime-600",
        text: "text-chart-1-foreground",
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case "waiting":
      return {
        bg: "bg-amber-500",
        text: "text-chart-4-foreground",
        icon: <Hourglass className="w-3 h-3" />,
      };
    case "cancel":
      return {
        bg: "bg-red-500",
        text: "text-destructive-foreground",
        icon: <XCircle className="w-3 h-3" />,
      };
    default:
      return {
        bg: "bg-neutral-800",
        text: "text-muted-foreground",
        icon: null,
      };
  }
};