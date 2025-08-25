import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdditionalOptionsSectionProps {
  interpreterId: string;
  setInterpreterId: (value: string) => void;
  interpreters: Array<{
    interpreterId: number | string;
    interpreterName: string;
    interpreterSurname: string;
  }>;
}

export function AdditionalOptionsSection({
  interpreterId,
  setInterpreterId,
  interpreters,
}: AdditionalOptionsSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">
        Additional Options
      </h2>

      {interpreters.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="interpreterId" className="text-sm font-medium text-foreground">
            Interpreter <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <Select
            value={interpreterId || "none"}
            onValueChange={(v) => setInterpreterId(v === "none" ? "" : v)}
          >
            <SelectTrigger id="interpreterId" className="w-full">
              <SelectValue placeholder="Select an interpreter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Interpreter</SelectItem>
              {interpreters.map((interpreter) => (
                <SelectItem
                  key={interpreter.interpreterId}
                  value={String(interpreter.interpreterId)}
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
