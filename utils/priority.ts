import React from "react";
import { Circle, Star, Users, Calendar, HelpCircle, AlertTriangle, Crown } from "lucide-react";

export type PriorityLevel = "VIP" | "DR_I" | "DR_II" | "DR_k" | "General";
export type MeetingType = "DR" | "VIP" | "Weekly" | "General" | "Urgent" | "President" | "Other";

export interface PriorityConfig {
  level: PriorityLevel;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  order: number; // Lower number = higher priority
}

export interface MeetingTypeConfig {
  type: MeetingType;
  label: string;
  icon: React.ElementType;
  color: string;
  priority: PriorityLevel;
}

export const PRIORITY_CONFIGS: Record<PriorityLevel, PriorityConfig> = {
  VIP: {
    level: "VIP",
    label: "VIP",
    icon: Users,
    color: "text-purple-600",
    bgColor: "",
    borderColor: "",
    order: 1,
  },
  DR_I: {
    level: "DR_I",
    label: "DR-I",
    icon: Star,
    color: "text-red-600",
    bgColor: "",
    borderColor: "",
    order: 2,
  },
  DR_II: {
    level: "DR_II",
    label: "DR-II",
    icon: Star,
    color: "text-orange-600",
    bgColor: "",
    borderColor: "",
    order: 3,
  },
  DR_k: {
    level: "DR_k",
    label: "DR-k",
    icon: Star,
    color: "text-amber-600",
    bgColor: "",
    borderColor: "",
    order: 4,
  },
  General: {
    level: "General",
    label: "General",
    icon: Circle,
    color: "text-gray-500",
    bgColor: "",
    borderColor: "",
    order: 5,
  },
};

export const MEETING_TYPE_CONFIGS: Record<MeetingType, MeetingTypeConfig> = {
  DR: {
    type: "DR",
    label: "DR",
    icon: Star,
    color: "text-red-600", // High priority red
    priority: "DR_I", // Default, will be overridden by drType
  },
  VIP: {
    type: "VIP",
    label: "VIP",
    icon: Users,
    color: "text-purple-600", // VIP purple
    priority: "VIP",
  },
  Weekly: {
    type: "Weekly",
    label: "Weekly",
    icon: Calendar,
    color: "text-green-600", // Regular green
    priority: "General",
  },
  General: {
    type: "General",
    label: "General",
    icon: Circle,
    color: "text-gray-500", // Neutral gray
    priority: "General",
  },
  Urgent: {
    type: "Urgent",
    label: "Urgent",
    icon: AlertTriangle,
    color: "text-orange-600", // Urgent orange
    priority: "DR_II", // High priority
  },
  President: {
    type: "President",
    label: "President",
    icon: Crown,
    color: "text-yellow-600",
    priority: "VIP",
  },
  Other: {
    type: "Other",
    label: "Other",
    icon: HelpCircle,
    color: "text-slate-600", // Neutral slate
    priority: "General",
  },
};

export function getPriorityLevel(
  meetingType?: string,
  drType?: string
): PriorityLevel {
  // VIP meetings have highest priority
  if (meetingType === "VIP") return "VIP";
  
  // DR meetings based on drType
  if (meetingType === "DR" && drType) {
    switch (drType) {
      case "DR_I": return "DR_I";
      case "DR_II": return "DR_II";
      case "DR_k": return "DR_k";
      default: return "General";
    }
  }
  
  // Default to General
  return "General";
}

export function getPriorityConfig(level: PriorityLevel): PriorityConfig {
  return PRIORITY_CONFIGS[level];
}

export function getPriorityIcon(level: PriorityLevel): React.ElementType {
  return PRIORITY_CONFIGS[level].icon;
}

export function sortByPriority<T extends { meetingType?: string; drType?: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const priorityA = getPriorityLevel(a.meetingType, a.drType);
    const priorityB = getPriorityLevel(b.meetingType, b.drType);
    return PRIORITY_CONFIGS[priorityA].order - PRIORITY_CONFIGS[priorityB].order;
  });
}

export function getMeetingTypeConfig(type: MeetingType): MeetingTypeConfig {
  return MEETING_TYPE_CONFIGS[type] || MEETING_TYPE_CONFIGS["General"];
}

export function getMeetingTypeBadge(
  meetingType?: string, 
  drType?: string,
  otherType?: string
): React.ReactElement {
  // Normalize meetingType and drType to canonical values used across the app
  const rawMt = (meetingType || "").trim();
  const mtUpper = rawMt.toLowerCase();

  let normalizedType: MeetingType;
  let normalizedDr: string | undefined = drType || undefined;

  switch (mtUpper) {
    case "dr":
      normalizedType = "DR";
      break;
    case "pdr":
      // Legacy: treat PDR as DR with subtype DR_PR
      normalizedType = "DR";
      normalizedDr = normalizedDr || "DR_PR";
      break;
    case "vip":
      normalizedType = "VIP";
      break;
    case "weekly":
      normalizedType = "Weekly";
      break;
    case "general":
      normalizedType = "General";
      break;
    case "urgent":
    case "augent": // legacy spelling
      normalizedType = "Urgent";
      break;
    case "president":
      normalizedType = "President";
      break;
    case "other":
      normalizedType = "Other";
      break;
    default:
      // If DR subtype is present but meetingType missing/unknown, treat as DR
      normalizedType = normalizedDr ? "DR" : "General";
  }

  // Normalize DR type spellings/aliases
  if (normalizedType === "DR" && normalizedDr) {
    const dt = normalizedDr.trim();
    const dtLower = dt.toLowerCase();
    if (dtLower === "pr_pr" || dtLower === "pr-pr" || dtLower === "dr-pr") normalizedDr = "DR_PR";
    else if (dtLower === "dr-i" || dtLower === "dr_i") normalizedDr = "DR_I";
    else if (dtLower === "dr-ii" || dtLower === "dr_ii") normalizedDr = "DR_II";
    else if (dtLower === "dr-k" || dtLower === "dr_k") normalizedDr = "DR_k";
  }

  const config = getMeetingTypeConfig(normalizedType);
  
  // Safety check to ensure config exists
  if (!config) {
    console.warn(`No config found for meeting type: ${normalizedType}`);
    return React.createElement("span", { className: "text-xs text-gray-500" }, "Unknown");
  }
  
  const Icon = config.icon;
  
  // For DR meetings, show tooltip with DR type
  if (normalizedType === "DR" && normalizedDr) {
    const drTypeLabel = normalizedDr.replace("_", "-"); // DR_I -> DR-I
    
    return React.createElement(
      "span",
      {
        className: `inline-flex items-center gap-1 text-xs font-semibold ${config.color} group relative cursor-help`,
        'aria-label': `DR Type: ${drTypeLabel}`,
      },
      React.createElement(Icon, { className: "h-3 w-3" }),
      config.label,
      // Tooltip
      React.createElement(
        "div",
        {
          className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-\[9999\] pointer-events-none transform -translate-y-1",
        },
        `DR Type: ${drTypeLabel}`
      )
    );
  }
  
  // For Other meetings, show tooltip with other type details
  if (normalizedType === "Other" && otherType) {
    return React.createElement(
      "span",
      {
        className: `inline-flex items-center gap-1 text-xs font-semibold ${config.color} group relative cursor-help`,
        'aria-label': `Other Type: ${otherType}`,
      },
      React.createElement(Icon, { className: "h-3 w-3" }),
      config.label,
      // Tooltip
      React.createElement(
        "div",
        {
          className: "absolute bottom-full left-1/2 -translate-x-1/2 mb-4 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-\[9999\] pointer-events-none transform -translate-y-1",
        },
        `Other Type: ${otherType}`
      )
    );
  }
  
  return React.createElement(
    "span",
    {
      className: `inline-flex items-center gap-1 text-xs font-semibold ${config.color}`,
    },
    React.createElement(Icon, { className: "h-3 w-3" }),
    config.label
  );
}

export function getPriorityBadge(level: PriorityLevel): React.ReactElement {
  const config = getPriorityConfig(level);
  const Icon = config.icon;
  
  return React.createElement(
    "span",
    {
      className: `inline-flex items-center gap-1 text-xs font-semibold ${config.color}`,
    },
    React.createElement(Icon, { className: "h-3 w-3" }),
    config.label
  );
}

