"use client";

import { useState } from "react";
import { Stack } from "@mui/material";
import FieldLabel from "@/src/shared/ui/field-label";
import ValidatedTextField from "@/src/shared/ui/validated-text-field";

export default function TaskDateFields({startDate,endDate}:{startDate:string;endDate:string}) {
  const [start,setStart]=useState(startDate);
  const [end,setEnd]=useState(endDate);
  const reversed=Boolean(start&&end&&end<start);
  return <Stack direction={{xs:"column",sm:"row"}} spacing={1.5}>
    <ValidatedTextField name="startDate" label={<FieldLabel requirement="required">시작일</FieldLabel>} type="date" value={start} onChange={event=>setStart(event.target.value)} required fullWidth slotProps={{inputLabel:{shrink:true}}}/>
    <ValidatedTextField name="endDate" label={<FieldLabel requirement="required">종료일</FieldLabel>} type="date" value={end} onChange={event=>setEnd(event.target.value)} required fullWidth error={reversed} helperText={reversed?"종료일은 시작일과 같거나 늦어야 합니다.":"시작일과 같거나 늦은 날짜를 선택해 주세요."} slotProps={{inputLabel:{shrink:true},htmlInput:{min:start||undefined}}}/>
  </Stack>;
}
