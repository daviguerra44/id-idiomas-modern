declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MYID_ORIGIN?: string;
    MYID_TRANSPORT_ORIGIN?: string;
    MYID_CONNECTION_VERIFIED?: string;
    MYID_SESSION_KEY?: string;
  }
}
