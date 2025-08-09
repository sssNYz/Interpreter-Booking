import { CheckCircle, Hourglass, XCircle } from "lucide-react";

export const getStatusStyle = (status: string) => {
  switch (status) {
    case "approved":
      return {
        bg: "bg-slate-50 border-green-700 border-[2px]",
        text: "text-green-800",
        icon: <CheckCircle className="w-3 h-3" />,
      };
    case "wait":
      return {
        bg: "bg-slate-50 border-yellow-700 border-[2px]",
        text: "text-yellow-700",
        icon: <Hourglass className="w-3 h-3" />,
      };
    case "cancelled":
      return {
        bg: "bg-slate-50 border-red-800 border-[2px]",
        text: "text-red-800",
        icon: <XCircle className="w-3 h-3" />,
      };
    default:
      return {
        bg: "bg-gray-100 border-gray-300",
        text: "text-gray-800",
        icon: null,
      };
  }
};
