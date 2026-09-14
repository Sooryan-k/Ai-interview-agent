/**
 * The tech-stack catalog.
 *
 * RULES (please keep these when adding entries):
 *  1. ATOMIC ONLY. One technology per entry. Never "MERN", never "React + Node" —
 *     those are four separate entries the user picks individually.
 *  2. `name` is the project's OFFICIAL name and casing, as written on its own site
 *     or docs: "Next.js" not "NextJS", "PostgreSQL" not "Postgres", "pandas" and
 *     "pytest" lowercase, "webpack" lowercase, "gRPC"/"tRPC" lowercase first letter.
 *     Every nickname developers actually type goes in `aliases` so search still
 *     finds it.
 *  3. `id` is a stable slug. Saved profiles store ids, never display names, so a
 *     future rename can't orphan anyone's data. Never change an existing id.
 *  4. `icon` is a simple-icons slug where the technology has a brand mark, or the
 *     literal "concept" for things like REST or System Design that have none. It's
 *     a reference only — the picker renders a per-category lucide icon, because
 *     lucide ships no brand icons and we don't want a CDN dependency on a page
 *     that has to work offline.
 *
 * Adding a technology later needs no UI changes: append an entry here.
 */

export type StackCategory =
  | "language"
  | "frontend"
  | "backend"
  | "mobile"
  | "database"
  | "devops"
  | "data-ai"
  | "testing"
  | "api-arch"
  | "security"
  | "gamedev"
  | "embedded"
  | "tools";

export interface Stack {
  id: string;
  name: string;
  category: StackCategory;
  aliases: string[];
  icon: string;
}

/** Display order and labels for the grouped dropdown. */
export const STACK_CATEGORIES: { id: StackCategory; label: string }[] = [
  { id: "language", label: "Languages" },
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "mobile", label: "Mobile" },
  { id: "database", label: "Databases & ORMs" },
  { id: "devops", label: "DevOps & Cloud" },
  { id: "data-ai", label: "Data & AI/ML" },
  { id: "testing", label: "Testing & QA" },
  { id: "api-arch", label: "API & Architecture" },
  { id: "security", label: "Security" },
  { id: "gamedev", label: "Game Development" },
  { id: "embedded", label: "Embedded & IoT" },
  { id: "tools", label: "Tools & Practice" },
];

export const STACKS: Stack[] = [
  // ---------------------------------------------------------------- languages
  { id: "javascript", name: "JavaScript", category: "language", aliases: ["js", "ecmascript", "es6"], icon: "javascript" },
  { id: "typescript", name: "TypeScript", category: "language", aliases: ["ts"], icon: "typescript" },
  { id: "python", name: "Python", category: "language", aliases: ["py", "python3"], icon: "python" },
  { id: "java", name: "Java", category: "language", aliases: ["core java", "java se"], icon: "openjdk" },
  { id: "csharp", name: "C#", category: "language", aliases: ["c sharp", "csharp", "cs"], icon: "csharp" },
  { id: "cpp", name: "C++", category: "language", aliases: ["cpp", "cplusplus", "c plus plus"], icon: "cplusplus" },
  { id: "c", name: "C", category: "language", aliases: ["ansi c", "c language"], icon: "c" },
  { id: "go", name: "Go", category: "language", aliases: ["golang"], icon: "go" },
  { id: "rust", name: "Rust", category: "language", aliases: ["rust-lang"], icon: "rust" },
  { id: "php", name: "PHP", category: "language", aliases: ["php8"], icon: "php" },
  { id: "ruby", name: "Ruby", category: "language", aliases: [], icon: "ruby" },
  { id: "kotlin", name: "Kotlin", category: "language", aliases: ["kt"], icon: "kotlin" },
  { id: "swift", name: "Swift", category: "language", aliases: [], icon: "swift" },
  { id: "dart", name: "Dart", category: "language", aliases: [], icon: "dart" },
  { id: "sql", name: "SQL", category: "language", aliases: ["structured query language", "ansi sql"], icon: "concept" },
  { id: "scala", name: "Scala", category: "language", aliases: [], icon: "scala" },
  { id: "r", name: "R", category: "language", aliases: ["r language", "rlang"], icon: "r" },
  { id: "matlab", name: "MATLAB", category: "language", aliases: ["mat lab"], icon: "concept" },
  { id: "perl", name: "Perl", category: "language", aliases: [], icon: "perl" },
  { id: "lua", name: "Lua", category: "language", aliases: [], icon: "lua" },
  { id: "elixir", name: "Elixir", category: "language", aliases: [], icon: "elixir" },
  { id: "haskell", name: "Haskell", category: "language", aliases: [], icon: "haskell" },
  { id: "objective-c", name: "Objective-C", category: "language", aliases: ["objc", "objective c"], icon: "concept" },
  { id: "bash", name: "Bash", category: "language", aliases: ["shell", "shell scripting", "sh", "zsh"], icon: "gnubash" },
  { id: "solidity", name: "Solidity", category: "language", aliases: ["smart contracts"], icon: "solidity" },
  { id: "zig", name: "Zig", category: "language", aliases: [], icon: "zig" },

  // ----------------------------------------------------------------- frontend
  { id: "react", name: "React", category: "frontend", aliases: ["reactjs", "react.js", "react js"], icon: "react" },
  { id: "nextjs", name: "Next.js", category: "frontend", aliases: ["next", "nextjs", "next js"], icon: "nextdotjs" },
  { id: "vuejs", name: "Vue.js", category: "frontend", aliases: ["vue", "vuejs", "vue js", "vue 3"], icon: "vuedotjs" },
  { id: "nuxt", name: "Nuxt", category: "frontend", aliases: ["nuxtjs", "nuxt.js", "nuxt js"], icon: "nuxtdotjs" },
  { id: "angular", name: "Angular", category: "frontend", aliases: ["angularjs", "angular 2"], icon: "angular" },
  { id: "svelte", name: "Svelte", category: "frontend", aliases: ["sveltejs"], icon: "svelte" },
  { id: "sveltekit", name: "SvelteKit", category: "frontend", aliases: ["svelte kit"], icon: "svelte" },
  { id: "astro", name: "Astro", category: "frontend", aliases: ["astrojs", "astro.build"], icon: "astro" },
  { id: "remix", name: "Remix", category: "frontend", aliases: ["remix run", "remix.run"], icon: "remix" },
  { id: "tailwindcss", name: "Tailwind CSS", category: "frontend", aliases: ["tailwind", "tailwindcss", "tw"], icon: "tailwindcss" },
  { id: "redux", name: "Redux", category: "frontend", aliases: ["redux toolkit", "rtk"], icon: "redux" },
  { id: "vite", name: "Vite", category: "frontend", aliases: ["vitejs"], icon: "vite" },
  { id: "html", name: "HTML", category: "frontend", aliases: ["html5", "markup"], icon: "html5" },
  { id: "css", name: "CSS", category: "frontend", aliases: ["css3", "stylesheets"], icon: "css3" },
  { id: "sass", name: "Sass", category: "frontend", aliases: ["scss"], icon: "sass" },
  { id: "bootstrap", name: "Bootstrap", category: "frontend", aliases: [], icon: "bootstrap" },
  { id: "jquery", name: "jQuery", category: "frontend", aliases: ["jquery"], icon: "jquery" },
  { id: "webpack", name: "webpack", category: "frontend", aliases: ["web pack"], icon: "webpack" },
  { id: "zustand", name: "Zustand", category: "frontend", aliases: [], icon: "concept" },
  { id: "tanstack-query", name: "TanStack Query", category: "frontend", aliases: ["react query", "react-query", "tanstack"], icon: "reactquery" },
  { id: "mui", name: "MUI", category: "frontend", aliases: ["material ui", "material-ui"], icon: "mui" },
  { id: "threejs", name: "Three.js", category: "frontend", aliases: ["threejs", "three js"], icon: "threedotjs" },
  { id: "solidjs", name: "SolidJS", category: "frontend", aliases: ["solid js", "solid"], icon: "solid" },
  { id: "qwik", name: "Qwik", category: "frontend", aliases: [], icon: "qwik" },
  { id: "storybook", name: "Storybook", category: "frontend", aliases: [], icon: "storybook" },
  { id: "electron", name: "Electron", category: "frontend", aliases: ["electronjs"], icon: "electron" },

  // ------------------------------------------------------------------ backend
  { id: "nodejs", name: "Node.js", category: "backend", aliases: ["node", "nodejs", "node js"], icon: "nodedotjs" },
  { id: "express", name: "Express", category: "backend", aliases: ["expressjs", "express.js"], icon: "express" },
  { id: "nestjs", name: "NestJS", category: "backend", aliases: ["nest", "nest js", "nest.js"], icon: "nestjs" },
  { id: "django", name: "Django", category: "backend", aliases: ["django rest framework", "drf"], icon: "django" },
  { id: "flask", name: "Flask", category: "backend", aliases: [], icon: "flask" },
  { id: "fastapi", name: "FastAPI", category: "backend", aliases: ["fast api"], icon: "fastapi" },
  { id: "spring-boot", name: "Spring Boot", category: "backend", aliases: ["springboot", "spring", "spring framework"], icon: "springboot" },
  { id: "aspnet-core", name: "ASP.NET Core", category: "backend", aliases: ["aspnet", "asp.net", "asp net", "aspnetcore"], icon: "dotnet" },
  { id: "dotnet", name: ".NET", category: "backend", aliases: ["dotnet", "dot net", "net core"], icon: "dotnet" },
  { id: "laravel", name: "Laravel", category: "backend", aliases: [], icon: "laravel" },
  { id: "rails", name: "Ruby on Rails", category: "backend", aliases: ["rails", "ror", "ruby rails"], icon: "rubyonrails" },
  { id: "gin", name: "Gin", category: "backend", aliases: ["gin gonic", "gin-gonic"], icon: "gin" },
  { id: "fastify", name: "Fastify", category: "backend", aliases: [], icon: "fastify" },
  { id: "koa", name: "Koa", category: "backend", aliases: ["koajs"], icon: "concept" },
  { id: "deno", name: "Deno", category: "backend", aliases: [], icon: "deno" },
  { id: "bun", name: "Bun", category: "backend", aliases: [], icon: "bun" },
  { id: "hono", name: "Hono", category: "backend", aliases: [], icon: "hono" },
  { id: "symfony", name: "Symfony", category: "backend", aliases: [], icon: "symfony" },
  { id: "phoenix", name: "Phoenix", category: "backend", aliases: ["phoenix framework"], icon: "phoenixframework" },
  { id: "quarkus", name: "Quarkus", category: "backend", aliases: [], icon: "quarkus" },
  { id: "celery", name: "Celery", category: "backend", aliases: [], icon: "celery" },

  // ------------------------------------------------------------------- mobile
  { id: "react-native", name: "React Native", category: "mobile", aliases: ["reactnative", "rn"], icon: "react" },
  { id: "flutter", name: "Flutter", category: "mobile", aliases: [], icon: "flutter" },
  { id: "swiftui", name: "SwiftUI", category: "mobile", aliases: ["swift ui"], icon: "swift" },
  { id: "jetpack-compose", name: "Jetpack Compose", category: "mobile", aliases: ["compose", "android compose"], icon: "jetpackcompose" },
  { id: "expo", name: "Expo", category: "mobile", aliases: [], icon: "expo" },
  { id: "ionic", name: "Ionic", category: "mobile", aliases: [], icon: "ionic" },
  { id: "android", name: "Android", category: "mobile", aliases: ["android sdk", "android development"], icon: "android" },
  { id: "ios", name: "iOS", category: "mobile", aliases: ["uikit", "ios development"], icon: "ios" },
  { id: "kotlin-multiplatform", name: "Kotlin Multiplatform", category: "mobile", aliases: ["kmp", "kmm"], icon: "kotlin" },
  { id: "dotnet-maui", name: ".NET MAUI", category: "mobile", aliases: ["maui", "xamarin"], icon: "dotnet" },

  // ----------------------------------------------------------------- database
  { id: "postgresql", name: "PostgreSQL", category: "database", aliases: ["postgres", "psql", "postgre"], icon: "postgresql" },
  { id: "mysql", name: "MySQL", category: "database", aliases: ["my sql"], icon: "mysql" },
  { id: "mongodb", name: "MongoDB", category: "database", aliases: ["mongo", "mongo db"], icon: "mongodb" },
  { id: "redis", name: "Redis", category: "database", aliases: [], icon: "redis" },
  { id: "sqlite", name: "SQLite", category: "database", aliases: ["sqlite3"], icon: "sqlite" },
  { id: "dynamodb", name: "Amazon DynamoDB", category: "database", aliases: ["dynamodb", "dynamo"], icon: "amazondynamodb" },
  { id: "supabase", name: "Supabase", category: "database", aliases: [], icon: "supabase" },
  { id: "firebase", name: "Firebase", category: "database", aliases: ["firestore"], icon: "firebase" },
  { id: "elasticsearch", name: "Elasticsearch", category: "database", aliases: ["elastic search", "elastic", "elk"], icon: "elasticsearch" },
  { id: "prisma", name: "Prisma", category: "database", aliases: ["prisma orm"], icon: "prisma" },
  { id: "cassandra", name: "Apache Cassandra", category: "database", aliases: ["cassandra"], icon: "apachecassandra" },
  { id: "neo4j", name: "Neo4j", category: "database", aliases: ["neo 4j", "graph database"], icon: "neo4j" },
  { id: "mariadb", name: "MariaDB", category: "database", aliases: ["maria db"], icon: "mariadb" },
  { id: "sql-server", name: "Microsoft SQL Server", category: "database", aliases: ["sql server", "mssql", "t-sql", "tsql"], icon: "microsoftsqlserver" },
  { id: "oracle-database", name: "Oracle Database", category: "database", aliases: ["oracle", "plsql", "pl/sql"], icon: "oracle" },
  { id: "drizzle", name: "Drizzle ORM", category: "database", aliases: ["drizzle"], icon: "drizzle" },
  { id: "sequelize", name: "Sequelize", category: "database", aliases: [], icon: "sequelize" },
  { id: "typeorm", name: "TypeORM", category: "database", aliases: ["type orm"], icon: "typeorm" },
  { id: "sqlalchemy", name: "SQLAlchemy", category: "database", aliases: ["sql alchemy"], icon: "sqlalchemy" },
  { id: "mongoose", name: "Mongoose", category: "database", aliases: [], icon: "mongoose" },
  { id: "clickhouse", name: "ClickHouse", category: "database", aliases: ["click house"], icon: "clickhouse" },
  { id: "pinecone", name: "Pinecone", category: "database", aliases: ["vector database", "vector db"], icon: "pinecone" },

  // ------------------------------------------------------------ devops, cloud
  { id: "aws", name: "Amazon Web Services", category: "devops", aliases: ["aws", "amazon aws"], icon: "amazonwebservices" },
  { id: "azure", name: "Microsoft Azure", category: "devops", aliases: ["azure"], icon: "microsoftazure" },
  { id: "gcp", name: "Google Cloud Platform", category: "devops", aliases: ["gcp", "google cloud"], icon: "googlecloud" },
  { id: "docker", name: "Docker", category: "devops", aliases: ["containers", "containerisation"], icon: "docker" },
  { id: "kubernetes", name: "Kubernetes", category: "devops", aliases: ["k8s", "kube"], icon: "kubernetes" },
  { id: "terraform", name: "Terraform", category: "devops", aliases: ["iac", "infrastructure as code"], icon: "terraform" },
  { id: "github-actions", name: "GitHub Actions", category: "devops", aliases: ["gh actions", "github ci"], icon: "githubactions" },
  { id: "jenkins", name: "Jenkins", category: "devops", aliases: [], icon: "jenkins" },
  { id: "nginx", name: "NGINX", category: "devops", aliases: ["nginx"], icon: "nginx" },
  { id: "linux", name: "Linux", category: "devops", aliases: ["ubuntu", "debian", "unix"], icon: "linux" },
  { id: "ansible", name: "Ansible", category: "devops", aliases: [], icon: "ansible" },
  { id: "gitlab-cicd", name: "GitLab CI/CD", category: "devops", aliases: ["gitlab ci", "gitlab pipelines"], icon: "gitlab" },
  { id: "circleci", name: "CircleCI", category: "devops", aliases: ["circle ci"], icon: "circleci" },
  { id: "helm", name: "Helm", category: "devops", aliases: [], icon: "helm" },
  { id: "prometheus", name: "Prometheus", category: "devops", aliases: [], icon: "prometheus" },
  { id: "grafana", name: "Grafana", category: "devops", aliases: [], icon: "grafana" },
  { id: "vercel", name: "Vercel", category: "devops", aliases: [], icon: "vercel" },
  { id: "netlify", name: "Netlify", category: "devops", aliases: [], icon: "netlify" },
  { id: "cloudflare", name: "Cloudflare", category: "devops", aliases: ["cloudflare workers"], icon: "cloudflare" },
  { id: "pulumi", name: "Pulumi", category: "devops", aliases: [], icon: "pulumi" },
  { id: "argo-cd", name: "Argo CD", category: "devops", aliases: ["argocd", "gitops"], icon: "argo" },
  { id: "datadog", name: "Datadog", category: "devops", aliases: ["data dog", "observability"], icon: "datadog" },
  { id: "aws-lambda", name: "AWS Lambda", category: "devops", aliases: ["lambda", "serverless"], icon: "awslambda" },

  // -------------------------------------------------------------- data, AI/ML
  { id: "pandas", name: "pandas", category: "data-ai", aliases: ["pandas"], icon: "pandas" },
  { id: "numpy", name: "NumPy", category: "data-ai", aliases: ["numpy", "np"], icon: "numpy" },
  { id: "pytorch", name: "PyTorch", category: "data-ai", aliases: ["torch", "py torch"], icon: "pytorch" },
  { id: "tensorflow", name: "TensorFlow", category: "data-ai", aliases: ["tensor flow", "tf"], icon: "tensorflow" },
  { id: "scikit-learn", name: "scikit-learn", category: "data-ai", aliases: ["sklearn", "scikit learn", "sci-kit learn"], icon: "scikitlearn" },
  { id: "spark", name: "Apache Spark", category: "data-ai", aliases: ["spark", "pyspark"], icon: "apachespark" },
  { id: "airflow", name: "Apache Airflow", category: "data-ai", aliases: ["airflow"], icon: "apacheairflow" },
  { id: "kafka", name: "Apache Kafka", category: "data-ai", aliases: ["kafka"], icon: "apachekafka" },
  { id: "snowflake", name: "Snowflake", category: "data-ai", aliases: [], icon: "snowflake" },
  { id: "langchain", name: "LangChain", category: "data-ai", aliases: ["lang chain"], icon: "langchain" },
  { id: "keras", name: "Keras", category: "data-ai", aliases: [], icon: "keras" },
  { id: "huggingface-transformers", name: "Hugging Face Transformers", category: "data-ai", aliases: ["huggingface", "hugging face", "transformers"], icon: "huggingface" },
  { id: "opencv", name: "OpenCV", category: "data-ai", aliases: ["open cv", "computer vision"], icon: "opencv" },
  { id: "matplotlib", name: "Matplotlib", category: "data-ai", aliases: ["mat plot lib"], icon: "concept" },
  { id: "databricks", name: "Databricks", category: "data-ai", aliases: ["data bricks"], icon: "databricks" },
  { id: "dbt", name: "dbt", category: "data-ai", aliases: ["data build tool"], icon: "dbt" },
  { id: "tableau", name: "Tableau", category: "data-ai", aliases: [], icon: "tableau" },
  { id: "power-bi", name: "Power BI", category: "data-ai", aliases: ["powerbi", "microsoft power bi"], icon: "powerbi" },
  { id: "jupyter", name: "Jupyter", category: "data-ai", aliases: ["jupyter notebook", "ipython"], icon: "jupyter" },
  { id: "xgboost", name: "XGBoost", category: "data-ai", aliases: ["xg boost"], icon: "concept" },
  { id: "hadoop", name: "Apache Hadoop", category: "data-ai", aliases: ["hadoop", "hdfs", "mapreduce"], icon: "apachehadoop" },
  { id: "flink", name: "Apache Flink", category: "data-ai", aliases: ["flink"], icon: "apacheflink" },
  { id: "llamaindex", name: "LlamaIndex", category: "data-ai", aliases: ["llama index"], icon: "concept" },
  { id: "mlflow", name: "MLflow", category: "data-ai", aliases: ["ml flow"], icon: "mlflow" },
  { id: "redshift", name: "Amazon Redshift", category: "data-ai", aliases: ["redshift"], icon: "amazonredshift" },
  { id: "bigquery", name: "BigQuery", category: "data-ai", aliases: ["big query", "google bigquery"], icon: "googlebigquery" },
  { id: "rag", name: "Retrieval-Augmented Generation", category: "data-ai", aliases: ["rag", "retrieval augmented generation"], icon: "concept" },

  // ------------------------------------------------------------- testing & QA
  { id: "jest", name: "Jest", category: "testing", aliases: [], icon: "jest" },
  { id: "vitest", name: "Vitest", category: "testing", aliases: [], icon: "vitest" },
  { id: "cypress", name: "Cypress", category: "testing", aliases: [], icon: "cypress" },
  { id: "playwright", name: "Playwright", category: "testing", aliases: [], icon: "playwright" },
  { id: "selenium", name: "Selenium", category: "testing", aliases: ["webdriver"], icon: "selenium" },
  { id: "junit", name: "JUnit", category: "testing", aliases: ["junit5"], icon: "junit5" },
  { id: "pytest", name: "pytest", category: "testing", aliases: ["py test"], icon: "pytest" },
  { id: "postman", name: "Postman", category: "testing", aliases: ["api testing"], icon: "postman" },
  { id: "testing-library", name: "Testing Library", category: "testing", aliases: ["react testing library", "rtl"], icon: "testinglibrary" },
  { id: "mocha", name: "Mocha", category: "testing", aliases: ["mochajs"], icon: "mocha" },
  { id: "cucumber", name: "Cucumber", category: "testing", aliases: ["bdd", "gherkin"], icon: "cucumber" },
  { id: "k6", name: "k6", category: "testing", aliases: ["load testing", "grafana k6"], icon: "k6" },
  { id: "appium", name: "Appium", category: "testing", aliases: ["mobile testing"], icon: "appium" },

  // ------------------------------------------------------- API & architecture
  { id: "rest", name: "REST", category: "api-arch", aliases: ["rest api", "restful", "http api"], icon: "concept" },
  { id: "graphql", name: "GraphQL", category: "api-arch", aliases: ["graph ql", "apollo"], icon: "graphql" },
  { id: "grpc", name: "gRPC", category: "api-arch", aliases: ["grpc", "protobuf", "protocol buffers"], icon: "grpc" },
  { id: "websockets", name: "WebSockets", category: "api-arch", aliases: ["websocket", "socket.io", "realtime"], icon: "socketdotio" },
  { id: "trpc", name: "tRPC", category: "api-arch", aliases: ["trpc"], icon: "trpc" },
  { id: "microservices", name: "Microservices", category: "api-arch", aliases: ["micro services", "distributed systems"], icon: "concept" },
  { id: "system-design", name: "System Design", category: "api-arch", aliases: ["hld", "high level design", "architecture", "scalability"], icon: "concept" },
  { id: "dsa", name: "Data Structures & Algorithms", category: "api-arch", aliases: ["dsa", "algorithms", "data structures", "leetcode"], icon: "concept" },
  { id: "oop", name: "Object-Oriented Programming", category: "api-arch", aliases: ["oop", "object oriented", "oops"], icon: "concept" },
  { id: "openapi", name: "OpenAPI", category: "api-arch", aliases: ["swagger", "open api"], icon: "openapiinitiative" },
  { id: "rabbitmq", name: "RabbitMQ", category: "api-arch", aliases: ["rabbit mq", "message queue", "amqp"], icon: "rabbitmq" },
  { id: "event-driven", name: "Event-Driven Architecture", category: "api-arch", aliases: ["eda", "event driven", "pub sub", "pubsub"], icon: "concept" },
  // "solid" alone belongs to SolidJS (its own short name); SOLID the principle
  // set is reachable via "solid principles" so the two never collide.
  { id: "design-patterns", name: "Design Patterns", category: "api-arch", aliases: ["gof", "gang of four", "solid principles"], icon: "concept" },
  { id: "ddd", name: "Domain-Driven Design", category: "api-arch", aliases: ["ddd", "domain driven design"], icon: "concept" },

  // ----------------------------------------------------------------- security
  { id: "owasp", name: "OWASP Top 10", category: "security", aliases: ["owasp", "web security", "appsec"], icon: "owasp" },
  { id: "oauth", name: "OAuth 2.0", category: "security", aliases: ["oauth", "oauth2", "openid connect", "oidc"], icon: "auth0" },
  { id: "jwt", name: "JSON Web Tokens", category: "security", aliases: ["jwt", "json web token"], icon: "jsonwebtokens" },
  { id: "penetration-testing", name: "Penetration Testing", category: "security", aliases: ["pentest", "pen testing", "ethical hacking"], icon: "concept" },
  { id: "cryptography", name: "Cryptography", category: "security", aliases: ["crypto", "encryption", "tls", "ssl"], icon: "concept" },

  // ------------------------------------------------------------ game dev
  { id: "unity", name: "Unity", category: "gamedev", aliases: ["unity3d", "unity 3d"], icon: "unity" },
  { id: "unreal-engine", name: "Unreal Engine", category: "gamedev", aliases: ["unreal", "ue5"], icon: "unrealengine" },
  { id: "godot", name: "Godot", category: "gamedev", aliases: ["godot engine"], icon: "godotengine" },

  // ----------------------------------------------------------- embedded & IoT
  { id: "arduino", name: "Arduino", category: "embedded", aliases: [], icon: "arduino" },
  { id: "raspberry-pi", name: "Raspberry Pi", category: "embedded", aliases: ["rpi", "raspberrypi"], icon: "raspberrypi" },
  { id: "rtos", name: "RTOS", category: "embedded", aliases: ["freertos", "real time os", "real-time operating system"], icon: "concept" },
  { id: "mqtt", name: "MQTT", category: "embedded", aliases: ["iot messaging"], icon: "mqtt" },

  // ---------------------------------------------------------- tools, practice
  { id: "git", name: "Git", category: "tools", aliases: ["version control", "git flow"], icon: "git" },
  { id: "github", name: "GitHub", category: "tools", aliases: ["git hub"], icon: "github" },
  { id: "gitlab", name: "GitLab", category: "tools", aliases: ["git lab"], icon: "gitlab" },
  { id: "jira", name: "Jira", category: "tools", aliases: ["atlassian jira"], icon: "jira" },
  { id: "figma", name: "Figma", category: "tools", aliases: ["ui design"], icon: "figma" },
  { id: "agile-scrum", name: "Agile & Scrum", category: "tools", aliases: ["agile", "scrum", "kanban", "sprint"], icon: "concept" },
];

// --------------------------------------------------------------------- lookup

export const STACK_BY_ID: ReadonlyMap<string, Stack> = new Map(
  STACKS.map((s) => [s.id, s])
);

export function isStackId(value: unknown): value is string {
  return typeof value === "string" && STACK_BY_ID.has(value);
}

export function stackName(id: string): string {
  return STACK_BY_ID.get(id)?.name ?? id;
}

/** Ids → official display names, dropping anything unknown. */
export function stackNames(ids: string[]): string[] {
  return ids.map((id) => STACK_BY_ID.get(id)?.name).filter(Boolean) as string[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[._/\\-]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Resolves free text ("nextjs", "Postgres", "React + Node") to a catalog id.
 * Used by the migration to map legacy stack strings, and by search.
 * Exact name/alias matches only — no fuzzy guessing, so a miss is reported
 * rather than silently mapped to the wrong technology.
 */
export function resolveStackId(input: string): string | null {
  const q = normalize(input);
  if (!q) return null;
  for (const s of STACKS) {
    if (normalize(s.id) === q || normalize(s.name) === q) return s.id;
    if (s.aliases.some((a) => normalize(a) === q)) return s.id;
  }
  return null;
}

/**
 * Splits a legacy combined label ("React + Node.js (Full-Stack)") into the
 * atomic ids it mentions. Returns matched ids and the fragments that didn't
 * resolve, so the migration can log them instead of dropping them silently.
 */
export function resolveStackList(input: string): {
  ids: string[];
  unmatched: string[];
} {
  const fragments = input
    .split(/[+,/&]|\band\b|\(|\)/gi)
    .map((f) => f.trim())
    .filter(Boolean);

  const ids: string[] = [];
  const unmatched: string[] = [];
  for (const f of fragments) {
    const id = resolveStackId(f);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else {
      unmatched.push(f);
    }
  }
  return { ids, unmatched };
}

/** Type-ahead over names and aliases. Prefix matches rank above substring. */
export function searchStacks(query: string, pool: Stack[] = STACKS): Stack[] {
  const q = normalize(query);
  if (!q) return pool;
  const scored: { s: Stack; rank: number }[] = [];
  for (const s of pool) {
    const name = normalize(s.name);
    const hay = [name, normalize(s.id), ...s.aliases.map(normalize)];
    let rank = -1;
    if (hay.some((h) => h === q)) rank = 0;
    else if (hay.some((h) => h.startsWith(q))) rank = 1;
    else if (hay.some((h) => h.includes(q))) rank = 2;
    if (rank >= 0) scored.push({ s, rank });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name))
    .map((x) => x.s);
}

export const MIN_STACKS = 1;
export const MAX_STACKS = 10;
