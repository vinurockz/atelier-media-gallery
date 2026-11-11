/** The server's view of who's signed in — see server/index.mjs's toPublicUser. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  googleLinked: boolean;
  /** Which customer this session is currently inside, if any — null means "show the customer picker." */
  activeCustomerId: string | null;
}
