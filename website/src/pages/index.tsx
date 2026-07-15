import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

export default function HomePage(): React.JSX.Element {
  return (
    <Layout title="AI Primitives Hub" description="Marketplace and registry for Copilot prompt bundles in VS Code">
      <main>
        <div className="container padding-top--md padding-bottom--lg">
          <article className="theme-doc-markdown markdown">
            <h1>AI Primitives Hub</h1>
            <p>
              Marketplace and registry for Copilot prompt bundles in VS Code.
            </p>
            <p>
              <Link to="/user-guide/getting-started">Get started</Link>
            </p>
          </article>
        </div>
      </main>
    </Layout>
  );
}