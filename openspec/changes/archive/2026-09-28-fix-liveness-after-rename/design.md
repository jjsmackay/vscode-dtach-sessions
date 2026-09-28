# Design

## Context

`readBoundSockets` returns the listening paths from `/proc/net/unix` exactly as
the kernel recorded them at `bind()`: absolute for short paths, basename-only
over the 108-byte `sun_path` cap. `socketIsBound` accepts either form of the
socket's **current** path. A rename moves the file but the kernel entry keeps the
old name, so neither form matches.

## Decisions

### D1. Match on `_<hash>.dtach`, not on the path
The hash is already the session's rename-invariant identity: kill resolves the
process by it, and status files are keyed by it. Matching the bound entry's file
name suffix `_<hash>.dtach` covers both forms the kernel records (absolute or
basename) and any number of renames.

*Alternatives*: follow the socket inode from `stat()` to the table. Rejected
because `/proc/net/unix`'s inode is the sockfs inode, not the filesystem inode
`stat()` returns, so the two don't join. Re-bind on rename: dtach offers no way
to do it.

### D2. Collision stays negligible
A 6-hex hash is minted per session, rename keeps it, and duplicate/create mint a
new one, so two sockets never share a hash under one `socketDir`. A match from
another directory would err toward "alive", which is pre-liveness behaviour, the
same stance the basename match already takes.

## Risks / Trade-offs

- [A hashless (pre-hash) socket renamed while live still reads dead] → Those
  sockets can't be renamed by this extension without a hash to keep. Accepted.
