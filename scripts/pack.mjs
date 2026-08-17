/**
 * Refuse to build a tarball npm is packing.
 *
 * Every package here depends on its siblings through `workspace:^`, which is
 * pnpm's protocol and which pnpm REWRITES to a real version range as it packs.
 * npm does not: it copies the string through, and the tarball then declares a
 * dependency no registry client can resolve —
 *
 *   npm error code EUNSUPPORTEDPROTOCOL
 *   npm error Unsupported URL Type "workspace:": workspace:^
 *
 * — which is a failure at INSTALL time, on a consumer's machine, for an artifact
 * that packed and published without complaint. So the wrong command is refused
 * here rather than described in a document nobody reads at the moment they run
 * it. The right one is `pnpm publish` (or `pnpm pack`).
 */
const agent = process.env.npm_config_user_agent ?? ''

if (agent && !agent.startsWith('pnpm')) {
  const who = agent.split('/')[0]
  console.error(
    `refusing to pack with ${who}: sibling dependencies are declared \`workspace:^\`, ` +
      `which only pnpm rewrites. Packed by ${who} the tarball ships that string verbatim ` +
      `and no consumer can install it. Use \`pnpm publish\`.`,
  )
  process.exit(1)
}
