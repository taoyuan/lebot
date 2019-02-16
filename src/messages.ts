import moment = require("moment");
import arrify = require("arrify");

const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const renewing = (certs) => `
Got certificate(s) for ${certs.altnames.join(", ")}
\tIssued at ${moment(certs.issuedAt).format(TIME_FORMAT)}
\tValid until ${moment(certs.expiresAt).format(TIME_FORMAT)}

Renewing them now
`;


export const installed = (certs, opts) => {
  const domains = arrify(opts.domains);

  const pkpath = opts.privkeypath.replace(/:configdir/g, opts.configdir).replace(/:hostname/g, domains[0]);
  const certpath = [opts.certpath, opts.chainpath, opts.fullchainpath, opts.bundlepath || ""].join("\n")
    .replace(/\n+/g, "\n")
    .replace(/:configdir/g, opts.configdir)
    .replace(/:hostname/g, opts.domains[0]);

  return `
Got certificate(s) for ${certs.altnames.join(", ")}
\tIssued at: ${moment(certs.issuedAt).format(TIME_FORMAT)}
\tValid until: ${moment(certs.expiresAt).format(TIME_FORMAT)}

Private key installed at:

${pkpath}

Certificates installed at:

${certpath}
`;

};
