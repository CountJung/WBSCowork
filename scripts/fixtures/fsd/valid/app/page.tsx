import { UserCard } from "@/src/widgets/user-card";
import { findUser } from "@/src/entities/user/index.server";

export default async function Page() {
  return <UserCard user={await findUser(1)} />;
}
