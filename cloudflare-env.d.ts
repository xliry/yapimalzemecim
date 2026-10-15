declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    FORM_SIGNING_KEY?: string;
    ADMIN_ACCESS_KEY?: string;
  }
}
