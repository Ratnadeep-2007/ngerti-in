import { createAvatar } from "@dicebear/core";
import { botttsNeutral, initials, bottts, lorelei, shapes } from "@dicebear/collection";

interface Props {
  seed: string;
  variant: "botttsNeutral" | "initials" | "bottts" | "lorelei" | "shapes";
}

export const generatedAvatarUri = ({ seed, variant }: Props) => {
  let avatar;

  if (variant === "botttsNeutral") {
    avatar = createAvatar(botttsNeutral, { seed });
  } else if (variant === "bottts") {
    avatar = createAvatar(bottts, { seed });
  } else if (variant === "lorelei") {
    avatar = createAvatar(lorelei, { seed });
  } else if (variant === "shapes") {
    avatar = createAvatar(shapes, { seed });
  } else {
    avatar = createAvatar(initials, { seed, fontWeight: 500, fontSize: 42 });
  }

  return avatar.toDataUri();
};
