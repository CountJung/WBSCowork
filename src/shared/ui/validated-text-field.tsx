"use client";

import { useId, useState } from "react";
import { TextField, type TextFieldProps } from "@mui/material";

/** Retains native constraints and gives their errors a persistent, associated message. */
export default function ValidatedTextField({id,helperText,required,onInvalid,onChange,error,...props}:TextFieldProps) {
  const fieldId=useId();
  const [validationError,setValidationError]=useState("");
  return <TextField {...props} id={id??fieldId} required={required} error={error||Boolean(validationError)}
    helperText={validationError||helperText||(required?"등록·저장할 때 입력해 주세요.":undefined)}
    onInvalid={event=>{
      const input=event.target as HTMLInputElement|HTMLTextAreaElement;
      setValidationError(input.validity.valueMissing?"이 항목을 입력해 주세요.":input.validationMessage);
      onInvalid?.(event);
    }}
    onChange={event=>{setValidationError("");onChange?.(event);}}/>;
}
