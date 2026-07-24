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
  required,
  onValueChange,
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string | null;
  placeholder?: string;
  disabled?: boolean;
  /** Purely a visual "*" cue — the hidden input backing this field can't use native HTML validation, so actual enforcement happens server-side. */
  required?: boolean;
  /** Notified with the resolved value (the "Other" free text when applicable) whenever it changes — for callers that need to react to what was picked, e.g. showing/hiding other fields based on the activity type. */
  onValueChange?: (resolvedValue: string) => void;
}) {
  const initialIsOther = !!defaultValue && !options.includes(defaultValue);
  const [selected, setSelected] = useState(initialIsOther ? OTHER_VALUE : (defaultValue ?? ""));
  const [otherText, setOtherText] = useState(initialIsOther ? (defaultValue ?? "") : "");

  const isOther = selected === OTHER_VALUE;

  function selectValue(v: string) {
    setSelected(v);
    onValueChange?.(v === OTHER_VALUE ? otherText : v);
  }

  function changeOtherText(v: string) {
    setOtherText(v);
    onValueChange?.(v);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Select value={selected} onValueChange={(v) => selectValue(v ?? "")} disabled={disabled}>
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
          onChange={(e) => changeOtherText(e.target.value)}
          placeholder="Specify…"
        />
      )}
      <input type="hidden" name={name} value={isOther ? otherText : selected} />
    </div>
  );
}
