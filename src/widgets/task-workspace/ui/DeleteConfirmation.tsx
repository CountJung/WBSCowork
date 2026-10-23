"use client";
import {useRef,useState,type ReactNode} from 'react';
import {Alert,Button,Checkbox,Dialog,DialogActions,DialogContent,DialogTitle,FormControlLabel,Stack} from '@mui/material';
import SubmitButton from '@/src/shared/ui/submit-button';
type Props={id:string;triggerLabel:string;warning:string;fields:Record<string,string>;action:(data:FormData)=>Promise<void>;children?:ReactNode;confirmLabel?:string;checkboxLabel?:string;confirmationName?:string};
export default function DeleteConfirmation({id,triggerLabel,warning,fields,action,children,confirmLabel='영구 삭제',checkboxLabel='모든 버전·파일이 영구 삭제됨을 확인했습니다',confirmationName='confirmRevisionDeletion'}:Props){
 const [open,setOpen]=useState(false),[checked,setChecked]=useState(false),[pending,setPending]=useState(false);const inFlight=useRef(false);
 const close=()=>{if(!inFlight.current){setOpen(false);setChecked(false);}};
 return <><Button id={`${id}-trigger`} type="button" size="small" color="error" onClick={()=>setOpen(true)} aria-haspopup="dialog">{triggerLabel}</Button>
 <Dialog open={open} onClose={close} aria-labelledby={`${id}-title`} fullWidth maxWidth="sm" data-testid={id}>
 <Stack component="form" action={async data=>{if(inFlight.current)return;inFlight.current=true;setPending(true);try{await action(data);}finally{inFlight.current=false;setPending(false);}}}>
 <DialogTitle id={`${id}-title`}>{triggerLabel.replace(/…$/,'')}</DialogTitle><DialogContent><Stack spacing={2}><Alert severity="error">{warning}</Alert>
 {Object.entries(fields).map(([name,value])=><input type="hidden" key={name} name={name} value={value}/>)}{children}
 <FormControlLabel control={<Checkbox name={confirmationName} value="yes" required checked={checked} disabled={pending} onChange={e=>setChecked(e.target.checked)}/>} label={`${checkboxLabel} · 필수`}/></Stack></DialogContent>
 <DialogActions sx={{flexWrap:'wrap',gap:1,p:2}}><Button type="button" disabled={pending} onClick={close}>삭제 취소</Button><SubmitButton disabled={!checked} pending={pending} pendingLabel="처리 중…" color="error" variant="contained">{confirmLabel}</SubmitButton></DialogActions>
 </Stack></Dialog></>;
}
