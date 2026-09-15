import { Link as ReactRouterLink } from "react-router-dom";

type RouterLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
};

export function Link({ href, ...props }: RouterLinkProps) {
  return <ReactRouterLink to={href} {...props} />;
}
