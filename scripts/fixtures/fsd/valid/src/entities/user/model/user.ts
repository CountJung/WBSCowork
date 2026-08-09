export type User = { id: number; name: string };

export function isNamed(user: User) {
  return user.name.trim().length > 0;
}
