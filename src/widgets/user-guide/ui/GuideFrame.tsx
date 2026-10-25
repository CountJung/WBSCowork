import type { ReactNode } from "react";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";

export type GuideContentsItem = { id: string; label: string };
export function GuideFrame({ title, intro, contents, breadcrumbs = [], children }: {
  title: string;
  intro: string;
  contents: GuideContentsItem[];
  breadcrumbs?: { label: string; href: string }[];
  children: ReactNode;
}) {
  return <Container component="main" data-testid="user-guide" sx={{ py: { xs: 3, md: 4 }, minWidth: 0 }}>
    <Box component="a" href="#guide-content" sx={{ position: "fixed", top: 8, left: 8, zIndex: 1600, transform: "translateY(-200%)", "&:focus": { transform: "translateY(0)" }, bgcolor: "background.paper", color: "primary.main", border: "2px solid", borderColor: "primary.main", p: 1.5, borderRadius: 1 }}>본문으로 건너뛰기</Box>
    <Stack spacing={3}>
      <Stack spacing={1.5}>
        {breadcrumbs.length ? <Stack component="nav" aria-label="현재 위치" direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>{breadcrumbs.map(item => <Box key={item.href}><Button component="a" href={item.href} size="small">{item.label}</Button><span aria-hidden="true"> / </span></Box>)}<Typography aria-current="page" variant="body2">{title}</Typography></Stack> : null}
        <Typography id="guide-title" component="h1" variant="h3" sx={{ fontSize: { xs: "1.9rem", sm: "2.5rem" }, lineHeight: 1.3 }}>{title}</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: "75ch", lineHeight: 1.85 }}>{intro}</Typography>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "15rem minmax(0, 1fr)" }, gap: { xs: 2, md: 4 }, alignItems: "start" }}>
        <Paper component="nav" aria-label="사용설명서 목차" variant="outlined" sx={{ p: 2, minWidth: 0, position: { md: "sticky" }, top: { md: 176, xl: 112 }, maxHeight: { md: "calc(100dvh - 200px)", xl: "calc(100dvh - 136px)" }, overflowY: { md: "auto" } }}>
          <Typography component="h2" variant="subtitle1" sx={{fontWeight:700}}>이 페이지 목차</Typography>
          <Stack component="ul" sx={{ listStyle: "none", p: 0, m: 0.5 }} spacing={0.25}>{contents.map(item => <Box component="li" key={item.id}><Button component="a" href={`#${item.id}`} sx={{ justifyContent: "flex-start", textAlign: "left", minHeight: 44, width: "100%" }}>{item.label}</Button></Box>)}</Stack>
          <Button component="a" href="/guide" variant="outlined" fullWidth sx={{ mt: 1 }}>역할 다시 선택</Button>
        </Paper>
        <Stack component="article" id="guide-content" tabIndex={-1} aria-labelledby="guide-title" spacing={4} sx={{ minWidth: 0, scrollMarginTop: { xs: 110, md: 200, xl: 130 }, "& section[id]": { scrollMarginTop: { xs: 110, md: 200, xl: 130 } }, "& p, & li, & dd": { lineHeight: 1.85 }, "& li + li": { mt: 1 }, "& ol, & ul": { pl: { xs: 2.5, sm: 3 } }, "& pre, & code": { overflowWrap: "anywhere", whiteSpace: "pre-wrap" } }}>{children}</Stack>
      </Box>
    </Stack>
  </Container>;
}

export function GuideSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <Stack component="section" id={id} aria-labelledby={`${id}-title`} spacing={2} sx={{ minWidth: 0 }}><Typography id={`${id}-title`} component="h2" variant="h5">{title}</Typography>{children}</Stack>;
}
