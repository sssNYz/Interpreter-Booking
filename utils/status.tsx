import { CheckCircle, Hourglass, XCircle } from "lucide-react";

export const getStatusStyle = (status: string) => {
  switch (status) {
    case "approved":
      return {
        bg: "bg-green-600/70",
        text: "text-green-800",
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case "wait":
      return {
        bg: "bg-yellow-500/70",
        text: "text-yellow-800",
        icon: <Hourglass className="w-3 h-3" />,
      };
    case "cancelled":
      return {
        bg: "bg-red-600/70",
        text: "text-red-900",
        icon: <XCircle className="w-3 h-3" />,
      };
    default:
      return {
        bg: "bg-gray-400/60",
        text: "text-gray-800",
        icon: null,
      };
  }
};
