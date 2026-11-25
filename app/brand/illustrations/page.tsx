import { PageTitle } from "@/components/PageTitle";
import { DriveLibrary } from "@/components/brand/DriveLibrary";
import { IllustrationRequest } from "@/components/brand/IllustrationRequest";
export default function Page() { return <><PageTitle>Illustrations</PageTitle><DriveLibrary kind="illustrations" title="Illustrations" action={<IllustrationRequest />} noMatch={<>Can’t find it? <IllustrationRequest variant="link" />.</>} /></>; }
