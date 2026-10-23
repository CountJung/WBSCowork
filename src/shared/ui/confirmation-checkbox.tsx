"use client";

import {Checkbox,FormControlLabel,type CheckboxProps} from "@mui/material";
import type {SxProps,Theme} from "@mui/material/styles";

type Props={name:string;label:string;value?:string;required?:boolean;size?:CheckboxProps["size"];sx?:SxProps<Theme>};

/** Keep the control and its label in one client boundary: MUI reads/clones control.props. */
export default function ConfirmationCheckbox({name,label,value="yes",required=true,size,sx}:Props){
  return <FormControlLabel control={<Checkbox name={name} value={value} required={required} size={size}/>} label={label} sx={sx}/>;
}
