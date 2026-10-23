import type {ReactNode} from 'react';
type Requirement='required'|'before_completion'|'optional';
const labels:Record<Requirement,string>={required:'필수',before_completion:'완료 전 필요',optional:'선택'};
export default function FieldLabel({children,requirement='optional'}:{children:ReactNode;requirement?:Requirement}){
 const color=requirement==='required'?'var(--mui-palette-error-main)':requirement==='before_completion'?'var(--mui-palette-primary-main)':'var(--mui-palette-text-secondary)';
 return <span>{children} <span style={{fontWeight:600,color}}>· {labels[requirement]}</span></span>;
}
