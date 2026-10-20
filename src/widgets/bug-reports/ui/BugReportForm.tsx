"use client";
import { useEffect, useState, useTransition } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";
import { validateScreenshotSelection } from "@/src/entities/bug-report";

export default function BugReportForm({token,createAction,submitAction}: {token:string;createAction:(data:FormData)=>Promise<void>;submitAction:(previous:{error:string}|null,data:FormData)=>Promise<{error:string}|null>}) {
  const [files,setFiles] = useState<{file:File;id:string}[]>([]);
  const [error,setError] = useState("");
  const [pending,startTransition] = useTransition();
  const [values,setValues] = useState({title:"",pagePath:"",reproduction:"",expected:"",actual:""});
  return <Stack component="form" action={createAction} spacing={2} onSubmit={event=>{
    event.preventDefault();
    if (pending) return;
    const data=new FormData(event.currentTarget);
    data.delete("screenshots");
    files.forEach(({file})=>data.append("screenshots",file));
    setError("");
    startTransition(async()=>{
      try {
        const result=await submitAction(null,data);
        if (result) setError(result.error);
      } catch (failure) {
        // Next redirects must reach the router; network failures keep this draft.
        if (failure && typeof failure === "object" && "digest" in failure && String(failure.digest).startsWith("NEXT_REDIRECT")) throw failure;
        setError("업로드 연결이 끊겼습니다. 입력과 첨부를 유지했습니다. 다시 시도해 주세요.");
      }
    });
  }}>
    <Typography variant="h5">새 버그 제보</Typography>
    <input type="hidden" name="requestToken" value={token}/>
    {([
      ["title","제목",160,0,true],
      ["pagePath","문제가 발생한 페이지 경로 (선택)",500,0,false],
      ["reproduction","재현 방법",8000,3,true],
      ["expected","예상 결과",4000,2,true],
      ["actual","실제 결과",4000,2,true],
    ] as const).map(([name,label,max,rows,required])=><TextField key={name} name={name} label={label} value={values[name]} onChange={e=>setValues({...values,[name]:e.target.value})} required={required} multiline={!!rows} minRows={rows||undefined} disabled={pending} slotProps={{htmlInput:{maxLength:max}}} helperText={name==="pagePath"?"/tasks 같은 내부 경로만. URL 쿼리와 fragment는 저장하지 않습니다.":undefined}/>)}
    <Stack spacing={1} aria-label="스크린샷 첨부">
      <Typography variant="subtitle1">스크린샷 (선택)</Typography>
      <Typography variant="body2" color="text.secondary" id="screenshot-help">PNG·JPEG·WebP · 파일당 2MB 이하 · 최대 3개. 비밀번호·고객 정보는 가린 후 첨부하세요.</Typography>
      <input type="file" name="screenshots" aria-label="스크린샷 선택" aria-describedby="screenshot-help" accept="image/png,image/jpeg,image/webp" multiple disabled={pending} style={{maxWidth:"100%"}} onChange={event=>{
        const selected=[...files,...Array.from(event.currentTarget.files??[]).map(file=>({file,id:crypto.randomUUID()}))];
        try {validateScreenshotSelection(selected.map(item=>item.file));setFiles(selected);setError("");} catch (failure) {setError((failure as Error).message);}
        event.currentTarget.value="";
      }}/>
      <Stack direction={{xs:"column",sm:"row"}} useFlexGap sx={{flexWrap:"wrap"}} spacing={2}>
        {files.map(({file,id},index)=><ScreenshotPreview key={id} file={file} index={index} pending={pending} remove={()=>setFiles(files.filter(item=>item.id!==id))}/>)}
      </Stack>
    </Stack>
    {error?<Alert severity="error" role="alert">{error}</Alert>:null}
    <Typography variant="body2">원문과 스크린샷은 저장 후 보존됩니다. 정정은 상세 화면의 추가 설명으로 남길 수 있습니다.</Typography>
    <Button type="submit" variant="contained" disabled={pending}>{pending?"스크린샷과 제보 저장 중…":"버그 제보 저장"}</Button>
  </Stack>;
}

function ScreenshotPreview({file,index,pending,remove}: {file:File;index:number;pending:boolean;remove:()=>void}) {
  const [url]=useState(()=>URL.createObjectURL(file));
  useEffect(()=>()=>URL.revokeObjectURL(url),[url]);
  return <Box sx={{width:{xs:"100%",sm:180},minWidth:0,border:"1px solid",borderColor:"divider",borderRadius:1,p:1}}>
    {/* Native images accept local object URLs, which the image optimizer cannot fetch. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={`첨부 미리보기 ${index+1}`} style={{width:"100%",height:120,objectFit:"contain"}}/>
    <Typography variant="body2" sx={{overflowWrap:"anywhere"}}>{file.name}</Typography>
    <Button type="button" aria-label={`${file.name} 제거`} disabled={pending} onClick={remove}>제거</Button>
  </Box>;
}
