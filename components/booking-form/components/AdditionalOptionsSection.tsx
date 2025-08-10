import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BadgeInfo } from "lucide-react";
import { FormData } from "../types";

type AdditionalOptionsSectionProps = {
  formData: FormData;
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  interpreters: {
    interpreterId: number;
    interpreterName: string;
    interpreterSurname: string;
  }[];
};

export function AdditionalOptionsSection({
  formData,
  updateField,
  interpreters,
}: AdditionalOptionsSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">
        Additional Options
      </h3>

      <div className="flex items-center space-x-2">
        <Switch
          id="highPriority"
          checked={formData.highPriority}
          onCheckedChange={(checked) =>
            updateField("highPriority", checked === true)
          }
        />
        <Label
          htmlFor="highPriority"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          High Priority Meeting
          <Tooltip>
            <TooltipTrigger>
              <BadgeInfo className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Read Define</p>
            </TooltipContent>
          </Tooltip>
        </Label>
      </div>

      {interpreters.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="interpreterId">Interpreter (Optional)</Label>
          <Select
            value={formData.interpreterId}
            onValueChange={(value) => updateField("interpreterId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an interpreter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No Interpreter</SelectItem>
              {interpreters.map((interpreter) => (
                <SelectItem
                  key={interpreter.interpreterId}
                  value={interpreter.interpreterId.toString()}
                >
                  {interpreter.interpreterName} {interpreter.interpreterSurname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
