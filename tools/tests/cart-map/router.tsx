export const createFileRoute = () => (options: any) => options;
export function Link({ children, to, ...props }: any) {
  return <a href={to} {...props} onClick={(event) => { event.preventDefault(); window.dispatchEvent(new Event('test-leave')); }}>{children}</a>;
}
