"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OTHER_VALUE } from "@/lib/outreach-taxonomy";

/**
 * A Select from a curated list, with an "Other (specify)" option that
 * reveals a free-text fallback input. Used for fields with a preferred set
 * of values but where real-world data won't always fit neatly into it.
 */
export function SelectWithOther({
  name,
  label,
  options,
  defaultValue,
  placeholder,
  disabled,
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string | null;
  placeholder?: string;
  disabled?: boolean;
}) {
  const initialIsOther = !!defaultValue && !options.includes(defaultValue);
  const [selected, setSelected] = useState(initialIsOther ? OTHER_VALUE : (defaultValue ?? ""));
  const [otherText, setOtherText] = useState(initialIsOther ? (defaultValue ?? "") : "");

  const isOther = selected === OTHER_VALUE;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Select value={selected} onValueChange={(v) => setSelected(v ?? "")} disabled={disabled}>
        <SelectTrigger id={name}>
          <SelectValue>
            {(value: string) => {
              const fallback = placeholder ?? `Select ${label.toLowerCase()}`;
              if (!value) return fallback;
              return value === OTHER_VALUE ? "Other (specify)" : value;
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_VALUE}>Other (specify)</SelectItem>
        </SelectContent>
      </Select>
      {isOther && (
        <Input
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          placeholder="Specify…"
        />
      )}
      <input type="hidden" name={name} value={isOther ? otherText : selected} />
    </div>
  );
}
