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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">
        Additional Options
      </h3>

      {interpreters.length > 0 && (
        <div className="grid gap-2">
          <Label htmlFor="interpreterId">Interpreter (Optional)</Label>
          <Select
            value={interpreterId || "none"}
            onValueChange={(v) => setInterpreterId(v === "none" ? "" : v)}
          >
            <SelectTrigger>
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
