'use strict';
/**
 * Deterministic seed for TalentDesk. Drops and recreates all tables.
 * Usage: node server/seed.js   (or require('./seed').seed())
 */
const { db, dropAll, init, toJson, transaction } = require('./db');

// ---------- deterministic PRNG ----------
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rand = mulberry32(20241028);
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
function sample(arr, k) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(k, a.length)));
}
function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}
const round1 = (n) => Math.round(n * 10) / 10;

// ---------- reference data ----------
const MALE = ['Aarav', 'Vihaan', 'Arjun', 'Rohan', 'Karthik', 'Siddharth', 'Rahul', 'Aditya', 'Nikhil', 'Pranav', 'Varun', 'Abhishek', 'Harsh', 'Manish', 'Sandeep', 'Vikram', 'Ankit', 'Gaurav', 'Rajesh', 'Suresh', 'Deepak', 'Amit', 'Kunal', 'Yash', 'Ishaan', 'Mohit', 'Saurabh', 'Akash', 'Naveen', 'Praveen', 'Venkatesh', 'Arvind', 'Shreyas', 'Tushar', 'Rohit', 'Farhan', 'Imran', 'Joseph', 'Sanjay', 'Hemant', 'Dhruv', 'Kabir', 'Mayank', 'Sumit', 'Vivek'];
const FEMALE = ['Ananya', 'Priya', 'Sneha', 'Divya', 'Pooja', 'Kavya', 'Neha', 'Shruti', 'Aishwarya', 'Meera', 'Ritika', 'Swati', 'Anjali', 'Nandini', 'Lakshmi', 'Deepika', 'Isha', 'Riya', 'Tanvi', 'Shalini', 'Pallavi', 'Megha', 'Aditi', 'Harini', 'Keerthana', 'Sana', 'Fatima', 'Nisha', 'Bhavana', 'Revathi', 'Sakshi', 'Simran', 'Kritika', 'Madhuri', 'Asha'];
const SURNAMES = ['Sharma', 'Verma', 'Iyer', 'Nair', 'Reddy', 'Rao', 'Patel', 'Shah', 'Gupta', 'Agarwal', 'Mehta', 'Joshi', 'Kulkarni', 'Deshpande', 'Menon', 'Pillai', 'Krishnan', 'Subramanian', 'Banerjee', 'Chatterjee', 'Mukherjee', 'Das', 'Bose', 'Singh', 'Chauhan', 'Yadav', 'Mishra', 'Tiwari', 'Pandey', 'Saxena', 'Kapoor', 'Malhotra', 'Khanna', 'Bhatia', 'Naidu', 'Hegde', 'Shetty', 'Kamath', 'Gowda', 'Jain', 'Sinha', 'Thakur', 'Khan', 'Qureshi', 'Fernandes', "D'Souza", 'Chopra', 'Arora', 'Bhatt', 'Desai'];

const CITIES = ['Bengaluru', 'Pune', 'Hyderabad', 'Mumbai', 'Delhi NCR', 'Chennai', 'Noida', 'Gurugram', 'Kolkata', 'Ahmedabad'];
const CITY_WEIGHTS = [['Bengaluru', 26], ['Pune', 13], ['Hyderabad', 15], ['Mumbai', 10], ['Delhi NCR', 7], ['Chennai', 10], ['Noida', 7], ['Gurugram', 7], ['Kolkata', 4], ['Ahmedabad', 4]];

const COLLEGES = ['IIT Bombay', 'IIT Madras', 'NIT Trichy', 'NIT Surathkal', 'BITS Pilani', 'VIT Vellore', 'Manipal Institute of Technology', 'PES University', 'RV College of Engineering', 'COEP Pune', 'Anna University', 'Jadavpur University', 'DTU Delhi', 'NSIT Delhi', 'IIIT Hyderabad', 'SRM Institute of Science and Technology', 'Amity University', 'Pune University', 'Osmania University', 'MS Ramaiah Institute of Technology', 'Nirma University', 'KIIT Bhubaneswar', 'Thapar Institute', 'Christ University'];
const MGMT_COLLEGES = ['IIM Bangalore', 'IIM Indore', 'XLRI Jamshedpur', 'SIBM Pune', 'NMIMS Mumbai', 'MDI Gurgaon', 'IIM Kozhikode', 'Symbiosis Institute of Business Management'];
const HR_COLLEGES = ['Symbiosis Centre for HR Management', 'XLRI Jamshedpur', 'TISS Mumbai', 'Christ University', 'Pune University', 'Osmania University', 'Amity Business School', 'Madras Christian College'];

const SERVICE_COS = ['Infosys', 'TCS', 'Wipro', 'HCLTech', 'Tech Mahindra', 'Cognizant', 'Capgemini', 'LTIMindtree', 'Mphasis', 'Persistent Systems', 'Accenture', 'Hexaware'];
const PRODUCT_COS = ['Flipkart', 'Swiggy', 'Zomato', 'Razorpay', 'PhonePe', 'Paytm', 'Freshworks', 'Zoho', 'CRED', 'Meesho', 'Ola', 'Myntra', 'Nykaa', 'Groww', 'Zerodha', 'InMobi', 'ShareChat', 'Dream11', 'Urban Company', 'BigBasket', 'Udaan', 'Postman', 'BrowserStack', 'Chargebee'];
const STARTUPS = ['Kloudnest Labs', 'Finvolve', 'Tracklio', 'Medisync Health', 'Agrowise', 'Quantiva Analytics', 'Shopnest', 'EduPlanet', 'Logiqo', 'PayStack India', 'NeoBanc', 'Cartwheel Commerce'];
const GCC_COS = ['Walmart Global Tech', 'Target India', 'Goldman Sachs', 'JP Morgan Chase', 'Intuit', 'SAP Labs', 'Oracle', 'Adobe', 'Microsoft IDC', 'Amazon', 'Thoughtworks', 'Publicis Sapient'];
const ALL_COS = [...SERVICE_COS, ...PRODUCT_COS, ...STARTUPS, ...GCC_COS];

const DOMAINS = ['e-commerce', 'fintech', 'payments', 'healthcare', 'edtech', 'logistics', 'retail banking', 'insurance', 'food delivery', 'SaaS', 'travel', 'telecom'];

// ---------- role families ----------
// lvl titles: [fresher/junior (0-2), mid (2-5), senior (5-9), lead (9+)]
const FAMILIES = {
  frontend: {
    count: 20,
    titles: ['Frontend Developer', 'Software Engineer - Frontend', 'Senior Frontend Engineer', 'Frontend Team Lead'],
    core: ['React', 'JavaScript', 'HTML', 'CSS'],
    pool: ['TypeScript', 'Redux', 'Next.js', 'Webpack', 'Jest', 'React Testing Library', 'Tailwind CSS', 'GraphQL', 'Node.js', 'Vue.js', 'Angular', 'Material UI', 'Storybook', 'Vite', 'SASS', 'REST APIs', 'Git', 'Figma'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Information Technology'], ['MCA', 'Computer Applications'], ['B.Tech', 'Electronics and Communication'], ['BCA', 'Computer Applications']],
    ctc: 1.05,
    summary: 'building fast, accessible and pixel-perfect web applications with React and modern JavaScript',
    bullets: [
      'Built and maintained {n} customer-facing modules in {s1} and {s2} for a {domain} platform used by {users} monthly users.',
      'Improved Lighthouse performance score from {a} to {b} by code-splitting, lazy loading and memoization of heavy {s1} components.',
      'Migrated a legacy jQuery codebase to {s1} with {s2}, reducing bundle size by {pct}%.',
      'Implemented a reusable design-system component library with {s2} and Storybook, adopted by {n} product teams.',
      'Wrote unit and integration tests using {s3}, raising coverage from {a}% to {b}%.',
      'Collaborated with UX designers in Figma to deliver responsive layouts and WCAG 2.1 accessibility fixes.',
      'Integrated REST and GraphQL APIs, handling caching, optimistic updates and error states in {s2}.',
      'Set up CI/CD checks (lint, tests, preview deployments) for the frontend monorepo.',
    ],
    leadBullets: ['Worked as team lead for a squad of {n} frontend engineers; ran code reviews, sprint planning and hiring interviews.', 'Defined frontend architecture guidelines and micro-frontend strategy across {n} product lines.'],
    projects: [
      ['Real-time Order Tracking Dashboard', 'A {s1} dashboard with WebSocket updates showing live order status for {domain} operations teams.'],
      ['Component Library "Prism UI"', 'Open-source style component library built with {s1} and {s2}, with theming and dark mode.'],
      ['Checkout Revamp', 'Rebuilt the checkout flow in {s1}, improving conversion by {pct}% through A/B testing.'],
      ['Admin Console', 'Role-based admin console with data grids, filters and charts built using {s2}.'],
    ],
  },
  java: {
    count: 20,
    titles: ['Java Developer', 'Software Engineer - Backend', 'Senior Java Backend Engineer', 'Technical Lead - Java'],
    core: ['Java', 'Spring Boot', 'SQL'],
    pool: ['Microservices', 'Hibernate', 'Kafka', 'MySQL', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'REST APIs', 'JUnit', 'Maven', 'Spring Cloud', 'MongoDB', 'Elasticsearch', 'Jenkins', 'Git', 'Multithreading'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Computer Science'], ['M.Tech', 'Computer Science'], ['MCA', 'Computer Applications'], ['B.Tech', 'Information Technology']],
    ctc: 1.1,
    summary: 'designing scalable backend services and microservices using Java, Spring Boot and distributed systems',
    bullets: [
      'Designed and developed {n} microservices in Java and Spring Boot for a {domain} platform handling {tps} transactions per second.',
      'Reduced p99 API latency by {pct}% by introducing {s2} caching and optimising {s3} queries.',
      'Built event-driven pipelines using {s1} for order, payment and notification workflows.',
      'Decomposed a monolithic application into microservices with independent deployments on {s2}.',
      'Wrote JUnit and integration tests and maintained {pct}%+ code coverage on critical services.',
      'Implemented CI/CD pipelines with Jenkins and Docker, cutting release time from days to hours.',
      'Handled production on-call, root-cause analysis and post-mortems for P1 incidents.',
      'Designed relational schemas and wrote complex SQL for reporting and reconciliation jobs.',
    ],
    leadBullets: ['Team lead for {n} backend engineers; owned technical design reviews, estimations and mentoring.', 'Drove the architecture roadmap for migrating {n} services to Kubernetes on AWS.'],
    projects: [
      ['Payments Reconciliation Engine', 'Spring Boot batch service that reconciles {users} daily transactions across banking partners.'],
      ['Inventory Microservice', 'High-throughput inventory service with {s1} events and optimistic locking.'],
      ['Loyalty Points Platform', 'Microservices-based rewards platform with Redis leaderboards and Kafka streams.'],
      ['Claims Processing System', 'Workflow engine for insurance claims built with Java, Hibernate and PostgreSQL.'],
    ],
  },
  backend: {
    count: 12,
    titles: ['Backend Developer', 'Software Engineer II', 'Senior Backend Engineer', 'Engineering Lead'],
    core: ['Node.js', 'Python', 'REST APIs'],
    pool: ['Express', 'Django', 'FastAPI', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'AWS', 'Microservices', 'GraphQL', 'TypeScript', 'RabbitMQ', 'Kafka', 'Go', 'Celery', 'Git'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Information Science'], ['MCA', 'Computer Applications'], ['B.Sc', 'Computer Science']],
    ctc: 1.05,
    summary: 'building reliable APIs and backend services in Node.js and Python for high-growth products',
    bullets: [
      'Built {n} REST and GraphQL APIs in {s1} and {s2} powering the {domain} mobile app.',
      'Designed a job-queue system with {s3} for asynchronous notifications, processing {users} messages a day.',
      'Moved services from VMs to Docker containers on AWS ECS, reducing infra cost by {pct}%.',
      'Implemented authentication, rate-limiting and audit logging across microservices.',
      'Optimised slow database queries and added indexes, cutting average response time by {pct}%.',
      'Wrote automated tests and set up CI/CD with GitHub Actions.',
    ],
    leadBullets: ['Led a team of {n} engineers as team lead; owned delivery for the platform pod.'],
    projects: [
      ['Notification Service', 'Multi-channel (SMS, email, push) notification microservice in {s1} with retries and templating.'],
      ['Analytics Ingestion API', 'FastAPI service ingesting {users} events/day into a data lake.'],
      ['Partner Integration Gateway', 'API gateway for third-party partner integrations with OAuth2 and webhooks.'],
    ],
  },
  fullstack: {
    count: 10,
    titles: ['Full Stack Developer', 'Full Stack Engineer', 'Senior Full Stack Engineer', 'Lead Full Stack Engineer'],
    core: ['JavaScript', 'React', 'Node.js'],
    pool: ['TypeScript', 'Express', 'MongoDB', 'PostgreSQL', 'Next.js', 'Redux', 'AWS', 'Docker', 'GraphQL', 'HTML', 'CSS', 'Jest', 'Microservices', 'Git'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Information Technology'], ['MCA', 'Computer Applications']],
    ctc: 1.05,
    summary: 'delivering end-to-end features across React frontends and Node.js backends',
    bullets: [
      'Owned end-to-end development of {n} features across {s1} frontend and {s2} backend for a {domain} product.',
      'Built a MERN-stack internal tool that replaced spreadsheets for {users} operations users.',
      'Designed MongoDB and PostgreSQL schemas and wrote migration scripts.',
      'Set up CI/CD pipelines and Dockerised the application for staging and production.',
      'Improved page load time by {pct}% with server-side rendering in Next.js.',
    ],
    leadBullets: ['Acted as team lead for {n} developers and coordinated releases with QA and product.'],
    projects: [
      ['Vendor Onboarding Portal', 'Full stack portal ({s1} + {s2}) for onboarding vendors with document uploads and approvals.'],
      ['Expense Management App', 'MERN application with OCR receipt parsing and approval workflows.'],
    ],
  },
  datascience: {
    count: 20,
    titles: ['Data Scientist', 'Data Scientist II', 'Senior Data Scientist', 'Lead Data Scientist'],
    core: ['Python', 'Machine Learning', 'SQL'],
    pool: ['Pandas', 'NumPy', 'Scikit-learn', 'TensorFlow', 'PyTorch', 'Deep Learning', 'NLP', 'Statistics', 'R', 'Tableau', 'Spark', 'Computer Vision', 'XGBoost', 'Time Series', 'A/B Testing', 'MLOps', 'LLMs', 'Power BI'],
    degrees: [['B.Tech', 'Computer Science'], ['M.Tech', 'Data Science'], ['M.Sc', 'Statistics'], ['M.Sc', 'Mathematics'], ['B.Sc', 'Statistics'], ['M.Tech', 'Artificial Intelligence']],
    ctc: 1.2,
    summary: 'applying machine learning, statistics and data analysis to solve business problems end to end',
    bullets: [
      'Built a machine learning model using {s1} and {s2} to predict customer churn for a {domain} business, improving retention by {pct}%.',
      'Developed demand forecasting with time series models (ARIMA, Prophet, LightGBM), reducing stock-outs by {pct}%.',
      'Designed and analysed A/B tests for pricing and recommendations using rigorous statistics.',
      'Built NLP pipelines for ticket classification and sentiment analysis using transformers.',
      'Deployed models as REST services with MLOps practices (MLflow, Docker, CI/CD) and monitored drift.',
      'Created Tableau and Power BI dashboards for leadership to track model KPIs.',
      'Engineered features from {users} rows of clickstream data using Spark and SQL.',
      'Fine-tuned deep learning models in {s3} for image classification with {pct}% accuracy gains.',
    ],
    leadBullets: ['Team lead for a data science pod of {n}; set modelling standards and mentored junior data scientists.'],
    projects: [
      ['Credit Risk Scoring', 'Gradient-boosted machine learning model for credit risk with SHAP explainability.'],
      ['Product Recommendation Engine', 'Collaborative filtering and embeddings-based recommender in {s1}, lifting CTR by {pct}%.'],
      ['Fraud Detection', 'Real-time anomaly detection for transactions using Isolation Forest and XGBoost.'],
      ['Resume Parser with NLP', 'Named entity recognition model to extract skills from resumes.'],
    ],
    rProb: 0.35,
  },
  dataeng: {
    count: 8,
    titles: ['Data Engineer', 'Data Engineer II', 'Senior Data Engineer', 'Lead Data Engineer'],
    core: ['Python', 'SQL', 'Spark'],
    pool: ['Airflow', 'Kafka', 'AWS', 'Snowflake', 'Databricks', 'Hadoop', 'Hive', 'Scala', 'dbt', 'BigQuery', 'Docker', 'ETL'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Information Technology'], ['M.Tech', 'Data Science']],
    ctc: 1.1,
    summary: 'building batch and streaming data pipelines and data platforms',
    bullets: [
      'Built ETL pipelines in {s1} and {s2} processing {users} records daily into the data warehouse.',
      'Orchestrated {n} workflows with Airflow and implemented data quality checks.',
      'Designed streaming ingestion with Kafka and Spark Structured Streaming.',
      'Reduced warehouse cost by {pct}% by partitioning and optimising queries.',
      'Supported data scientists with feature stores for machine learning models.',
    ],
    leadBullets: ['Led a team of {n} data engineers as team lead for the data platform.'],
    projects: [
      ['Customer 360 Lakehouse', 'Lakehouse on Databricks unifying customer data from {n} sources.'],
      ['Clickstream Pipeline', 'Real-time Kafka + Spark pipeline for product analytics.'],
    ],
  },
  devops: {
    count: 15,
    titles: ['DevOps Engineer', 'Cloud Engineer', 'Senior DevOps Engineer', 'DevOps Lead / SRE Manager'],
    core: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'],
    pool: ['Terraform', 'Jenkins', 'Linux', 'Ansible', 'Prometheus', 'Grafana', 'Azure', 'GCP', 'Helm', 'Python', 'Bash', 'GitHub Actions', 'ELK Stack', 'ArgoCD', 'Networking'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Electronics'], ['B.Tech', 'Information Technology'], ['B.Sc', 'Computer Science']],
    ctc: 1.1,
    summary: 'automating infrastructure, CI/CD and cloud operations with a strong reliability mindset',
    bullets: [
      'Provisioned AWS infrastructure for {n} environments using Terraform (infrastructure as code).',
      'Built CI/CD pipelines with {s2} that deploy {n} microservices to Kubernetes multiple times a day.',
      'Set up monitoring and alerting with Prometheus and Grafana, reducing MTTR by {pct}%.',
      'Migrated on-prem workloads to the cloud, cutting hosting cost by {pct}%.',
      'Hardened Linux servers, managed IAM policies and implemented secrets management.',
      'Wrote Helm charts and GitOps workflows with ArgoCD for {domain} services.',
      'Participated in on-call rotations and led blameless post-mortems.',
    ],
    leadBullets: ['Team lead for the platform/SRE team of {n} engineers; defined SLOs and incident processes.'],
    projects: [
      ['Kubernetes Platform Migration', 'Moved {n} services from EC2 to EKS with autoscaling and zero-downtime deploys.'],
      ['Self-service CI/CD Templates', 'Reusable pipeline templates that onboard a new microservice in under an hour.'],
      ['Cost Optimisation Program', 'Spot instances, rightsizing and reserved capacity saving {pct}% of monthly AWS spend.'],
    ],
  },
  qa: {
    count: 14,
    titles: ['QA Engineer', 'QA Automation Engineer', 'Senior SDET', 'QA Lead'],
    core: ['Selenium', 'Test Automation', 'Manual Testing'],
    pool: ['Java', 'TestNG', 'Cypress', 'Playwright', 'API Testing', 'Postman', 'Rest Assured', 'Jenkins', 'JIRA', 'Appium', 'Python', 'Cucumber', 'BDD', 'Performance Testing', 'JMeter', 'SQL'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Electronics and Communication'], ['MCA', 'Computer Applications'], ['B.Sc', 'Computer Science']],
    ctc: 0.85,
    summary: 'ensuring product quality through robust test automation frameworks and thorough manual testing',
    bullets: [
      'Designed a {s1} automation framework with {s2} and Page Object Model covering {n} regression scenarios.',
      'Automated API tests using Rest Assured and Postman, integrated into Jenkins CI/CD.',
      'Reduced regression cycle time from {a} days to {b} hours through parallel test execution.',
      'Performed functional, regression, smoke and UAT testing for {domain} releases.',
      'Logged and triaged defects in JIRA and worked closely with developers to drive fixes.',
      'Ran performance tests with JMeter and identified bottlenecks before peak sale events.',
    ],
    leadBullets: ['QA team lead for {n} testers; owned test strategy, release sign-offs and quality metrics.'],
    projects: [
      ['Hybrid Automation Framework', 'Data-driven + keyword-driven framework using Selenium, TestNG and Extent Reports.'],
      ['Mobile App Test Suite', 'Appium suite for Android and iOS apps running on a device farm.'],
    ],
  },
  android: {
    count: 10,
    titles: ['Android Developer', 'Android Engineer', 'Senior Android Engineer', 'Mobile Engineering Lead'],
    core: ['Kotlin', 'Android', 'Java'],
    pool: ['Jetpack Compose', 'MVVM', 'Coroutines', 'Retrofit', 'Room', 'Dagger Hilt', 'Firebase', 'RxJava', 'Git', 'REST APIs', 'Unit Testing', 'Gradle'],
    degrees: [['B.Tech', 'Computer Science'], ['B.E.', 'Information Technology'], ['MCA', 'Computer Applications']],
    ctc: 1.05,
    summary: 'building smooth, well-architected native Android apps in Kotlin',
    bullets: [
      'Developed features for a {domain} Android app with {users}+ installs on the Play Store using {s1}.',
      'Migrated UI screens from XML to Jetpack Compose, reducing UI code by {pct}%.',
      'Implemented MVVM architecture with Coroutines, Flow and {s2}.',
      'Reduced app crash rate from {a}% to {b}% using Firebase Crashlytics insights.',
      'Integrated payment SDKs, deep links and push notifications.',
    ],
    leadBullets: ['Mobile team lead for {n} engineers across Android and iOS.'],
    projects: [
      ['Offline-first Field Sales App', 'Kotlin app with Room sync and WorkManager for field agents.'],
      ['UPI Payments Module', 'Secure in-app UPI payment flow with biometric authentication.'],
    ],
  },
  pm: {
    count: 9,
    titles: ['Associate Product Manager', 'Product Manager', 'Senior Product Manager', 'Group Product Manager'],
    core: ['Product Management', 'Product Strategy', 'Roadmapping'],
    pool: ['Agile', 'Scrum', 'JIRA', 'SQL', 'A/B Testing', 'User Research', 'Stakeholder Management', 'Analytics', 'Wireframing', 'Figma', 'Go-to-Market', 'PRD Writing', 'Mixpanel'],
    degrees: [['MBA', 'Marketing'], ['MBA', 'Product Management'], ['B.Tech', 'Computer Science'], ['PGDM', 'Strategy']],
    ctc: 1.3,
    minExp: 1,
    summary: 'owning product discovery to delivery and driving measurable business outcomes',
    bullets: [
      'Owned the roadmap for the {domain} onboarding funnel, improving activation by {pct}%.',
      'Wrote PRDs and user stories, prioritised the backlog and ran Agile ceremonies with {n} engineers.',
      'Conducted user research and usability testing with {n}+ customers to validate features.',
      'Defined success metrics and ran A/B testing, using SQL and Mixpanel for analysis.',
      'Launched {n} features end to end, coordinating with design, engineering, marketing and sales.',
      'Managed stakeholders across business, compliance and operations.',
    ],
    leadBullets: ['Managed a team of {n} product managers and set product vision for the business unit.'],
    projects: [
      ['Subscription Launch', 'Launched a subscription plan that grew recurring revenue by {pct}% in two quarters.'],
      ['Seller Self-serve Portal', 'Defined and shipped a self-serve portal reducing support tickets by {pct}%.'],
    ],
  },
  hr: {
    count: 12,
    titles: ['HR Executive', 'HR Generalist', 'Senior HR Executive', 'HR Manager'],
    core: ['Recruitment', 'Talent Acquisition', 'Employee Engagement'],
    pool: ['Onboarding', 'HRMS', 'Payroll', 'MS Excel', 'Naukri Resdex', 'LinkedIn Recruiter', 'Sourcing', 'Screening', 'Statutory Compliance', 'Employee Relations', 'Performance Management', 'Campus Hiring', 'Exit Interviews'],
    degrees: [['MBA', 'Human Resources'], ['PGDM', 'HR'], ['BBA', 'Business Administration'], ['M.A.', 'Psychology'], ['B.Com', 'Commerce']],
    ctc: 0.6,
    summary: 'end-to-end recruitment, onboarding and employee lifecycle management',
    bullets: [
      'Managed end-to-end recruitment for {n}+ positions per quarter across tech and non-tech roles.',
      'Sourced candidates via job portals, LinkedIn and referrals; screened and scheduled interviews.',
      'Coordinated onboarding and induction for {n} new joiners every month.',
      'Ran employee engagement initiatives that improved eNPS by {pct} points.',
      'Maintained HRMS records, attendance and inputs for payroll processing.',
      'Organised campus hiring drives at {n} engineering colleges.',
    ],
    leadBullets: ['Led an HR team of {n}; owned HR policies, compliance and performance management cycles.'],
    projects: [
      ['Campus Hiring Program', 'Ran a campus program hiring {n} graduate trainees across 6 colleges.'],
      ['Onboarding Revamp', 'Digitised onboarding documentation, cutting time-to-productivity by {pct}%.'],
    ],
  },
};

// ---------- builders ----------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOW = new Date();
function monthsAgo(m) {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() - m, 1);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function daysAgoIso(days, hourJitter = true) {
  const d = new Date(NOW.getTime() - days * 86400000 - (hourJitter ? int(0, 23) * 3600000 + int(0, 59) * 60000 : 0));
  return d.toISOString();
}

function levelFor(exp) {
  if (exp < 2) return 0;
  if (exp < 5) return 1;
  if (exp < 9) return 2;
  return 3;
}

function fillTemplate(t, ctx) {
  return t
    .replace(/a {domain}/g, () => (/^[aeiou]/i.test(ctx.domain) ? 'an ' : 'a ') + ctx.domain)
    .replace(/\{s1\}/g, ctx.s[0])
    .replace(/\{s2\}/g, ctx.s[1] || ctx.s[0])
    .replace(/\{s3\}/g, ctx.s[2] || ctx.s[0])
    .replace(/\{domain\}/g, () => ctx.domain)
    .replace(/\{n\}/g, () => String(int(3, 12)))
    .replace(/\{pct\}/g, () => String(int(12, 45)))
    .replace(/\{users\}/g, () => pick(['50K', '200K', '1M', '5M', '10M', '2 lakh', '20 lakh']))
    .replace(/\{tps\}/g, () => String(pick([500, 1200, 3000, 8000, 15000])))
    .replace(/\{a\}/g, () => String(int(30, 60)))
    .replace(/\{b\}/g, () => String(int(75, 95)));
}

function companyFor(level) {
  if (level === 0) return weighted([[pick(SERVICE_COS), 4], [pick(STARTUPS), 4], [pick(PRODUCT_COS), 2]]);
  return weighted([[pick(SERVICE_COS), 3], [pick(STARTUPS), 2], [pick(PRODUCT_COS), 4], [pick(GCC_COS), 3]]);
}

function makeCandidate(familyKey, fam, idx, usedEmails) {
  const female = chance(0.42);
  const first = female ? pick(FEMALE) : pick(MALE);
  const last = pick(SURNAMES);
  const name = `${first} ${last}`;
  const gender = female ? 'Female' : 'Male';

  // experience: skew towards 1-8 yrs
  const minExp = fam.minExp || 0;
  let exp = weighted([[int(0, 1) + rand(), 18], [2 + rand() * 3, 34], [5 + rand() * 4, 30], [9 + rand() * 6, 18]]);
  exp = Math.max(minExp, Math.min(15, round1(exp)));
  if (exp < 1 && chance(0.5)) exp = 0;
  const level = levelFor(exp);
  const title = fam.titles[level];

  // skills
  let skills = [...fam.core];
  if (familyKey === 'datascience' && chance(fam.rProb)) skills.push('R');
  // juniors sometimes miss a core skill
  if (level === 0 && skills.length > 3 && chance(0.4)) skills.splice(int(1, skills.length - 1), 1);
  const extra = sample(fam.pool.filter((s) => !skills.includes(s)), int(3, 5) + level);
  skills = [...skills, ...extra];

  const location = weighted(CITY_WEIGHTS);
  const prefPool = CITIES.filter((c) => c !== location);
  let preferred = [location, ...sample(prefPool, int(0, 2))];
  if (chance(0.18)) preferred.push('Remote');
  preferred = [...new Set(preferred)];

  // ctc (LPA)
  const base = exp === 0 ? 3.2 + rand() * 2 : 3.5 + exp * (1.8 + rand() * 1.4) + (level >= 2 ? exp * 0.4 : 0);
  const currentCtc = round1(Math.max(2.4, base * fam.ctc));
  const expectedCtc = round1(currentCtc * (1.2 + rand() * 0.25));

  const notice = weighted([[0, 10], [15, 12], [30, 30], [60, 26], [90, 22]]);

  const domain = pick(DOMAINS);

  // career history
  const totalMonths = Math.round(exp * 12);
  const jobs = [];
  if (totalMonths === 0) {
    // fresher: internship only
  } else {
    let remaining = totalMonths;
    let cursor = 0; // months ago (end)
    const nJobs = Math.min(4, Math.max(1, Math.round(exp / 3.2) + (chance(0.3) ? 1 : 0)));
    for (let j = 0; j < nJobs && remaining > 0; j++) {
      const span = j === nJobs - 1 ? remaining : Math.max(8, Math.round(remaining / (nJobs - j) + int(-6, 6)));
      const lvl = Math.max(0, level - j);
      jobs.push({
        title: fam.titles[lvl],
        company: j === 0 ? null : companyFor(lvl),
        from: monthsAgo(cursor + span),
        to: j === 0 ? 'Present' : monthsAgo(cursor),
        lvl,
      });
      cursor += span;
      remaining -= span;
    }
  }
  const currentCompany = jobs.length ? companyFor(level) : null;
  if (jobs.length) jobs[0].company = currentCompany;

  // education
  const [degree, branch] = pick(fam.degrees);
  const isMgmt = ['MBA', 'PGDM'].includes(degree);
  const college = isMgmt ? (familyKey === 'hr' ? pick(HR_COLLEGES) : pick(MGMT_COLLEGES)) : familyKey === 'hr' ? pick(HR_COLLEGES) : pick(COLLEGES);
  const gradYear = NOW.getFullYear() - Math.ceil(exp) - (exp === 0 ? 0 : int(0, 1));
  const education = `${degree} (${branch}), ${college}, ${gradYear}`;

  const headline =
    exp === 0
      ? `${title} | Fresher | ${skills.slice(0, 3).join(', ')}`
      : `${title} at ${currentCompany} | ${round1(exp)} yrs | ${skills.slice(0, 4).join(' · ')}`;

  // email / phone
  let base2 = `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
  let email = `${base2}@example.com`;
  let k = 1;
  while (usedEmails.has(email)) email = `${base2}${++k}@example.com`;
  usedEmails.add(email);
  const phone = `+91 ${pick(['98', '99', '97', '96', '95', '91', '88', '87', '81', '70'])}${String(int(10000000, 99999999))}`;

  // ---- resume text ----
  const ctx = (sk) => ({ s: [fam.core[0], ...sk.filter((s) => s !== fam.core[0])], domain });
  const lines = [];
  lines.push(name.toUpperCase());
  lines.push(headline);
  lines.push(`${location} | ${email} | ${phone}`);
  lines.push('');
  lines.push('PROFESSIONAL SUMMARY');
  const expPhrase = exp === 0 ? 'Recent graduate and former intern' : `${title} with ${round1(exp)} years of experience`;
  let summary = `${expPhrase} ${exp === 0 ? 'passionate about' : 'in'} ${fam.summary}. Hands-on with ${skills.slice(0, 5).join(', ')}.`;
  if (level >= 3) summary += ' Experienced team lead who has hired, mentored and grown high-performing teams.';
  else if (level === 2) summary += ' Comfortable owning work end to end and mentoring junior team members.';
  summary += ` Domain experience in ${domain}${chance(0.5) ? ` and ${pick(DOMAINS.filter((d) => d !== domain))}` : ''}.`;
  if (notice <= 15) summary += ' Available to join immediately or at short notice.';
  lines.push(summary);
  lines.push('');
  lines.push('WORK EXPERIENCE');
  for (const j of jobs) {
    lines.push(`${j.title} - ${j.company} (${j.from} - ${j.to})`);
    const nb = j.lvl >= 2 ? 4 : 3;
    const bullets = sample(fam.bullets, nb).map((b) => fillTemplate(b, ctx(sample(skills, 3))));
    if (j.lvl >= 3 && fam.leadBullets) bullets.unshift(fillTemplate(pick(fam.leadBullets), ctx(sample(skills, 3))));
    for (const b of bullets) lines.push(`- ${b}`);
    lines.push('');
  }
  // internships for juniors
  if (level === 0 || chance(0.15)) {
    const internCo = pick([...STARTUPS, ...PRODUCT_COS]);
    const role = familyKey === 'hr' ? 'HR Intern' : familyKey === 'pm' ? 'Product Intern' : `${fam.titles[0]} Intern`;
    lines.push(`${role} - ${internCo} (6 months, internship)`);
    lines.push(`- Worked as an intern on the ${domain} team, contributing to ${pick(fam.projects)[0].toLowerCase()}.`);
    lines.push(`- ${fillTemplate(pick(fam.bullets), ctx(sample(skills, 3)))}`);
    lines.push('');
  }
  lines.push('PROJECTS');
  for (const [pName, pDesc] of sample(fam.projects, 2)) {
    lines.push(`${pName}: ${fillTemplate(pDesc, ctx(sample(skills, 3)))}`);
  }
  lines.push('');
  lines.push('EDUCATION');
  lines.push(education);
  if (familyKey === 'datascience' && skills.includes('R')) lines.push('Coursework: Statistical Learning in R, Probability, Linear Algebra, Optimisation.');
  lines.push('');
  lines.push('SKILLS');
  lines.push(skills.join(', '));
  if (chance(0.4)) {
    lines.push('');
    lines.push('CERTIFICATIONS');
    const certs = {
      devops: ['AWS Certified Solutions Architect - Associate', 'Certified Kubernetes Administrator (CKA)', 'HashiCorp Terraform Associate'],
      datascience: ['Google Professional Machine Learning Engineer', 'Deep Learning Specialization - Coursera', 'IBM Data Science Professional Certificate'],
      java: ['Oracle Certified Professional Java SE 11', 'AWS Certified Developer - Associate'],
      qa: ['ISTQB Foundation Level', 'Certified Selenium Professional'],
      pm: ['Certified Scrum Product Owner (CSPO)', 'Pragmatic Institute PMC-III'],
      hr: ['SHRM Certified Professional', 'Certified Talent Acquisition Specialist'],
    }[familyKey] || ['Meta Front-End Developer Certificate', 'AWS Cloud Practitioner', 'MongoDB Associate Developer'];
    lines.push(sample(certs, int(1, 2)).join('; '));
  }
  const resume_text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    name,
    email,
    phone,
    headline,
    current_title: exp === 0 ? `${fam.titles[0]} (Fresher)` : title,
    current_company: currentCompany,
    location,
    preferred_locations: preferred,
    experience_years: round1(exp),
    current_ctc: exp === 0 ? null : currentCtc,
    expected_ctc: exp === 0 ? round1(3.5 + rand() * 3 * fam.ctc) : expectedCtc,
    notice_period_days: exp === 0 ? 0 : notice,
    skills,
    education,
    resume_text,
    gender,
    last_active: daysAgoIso(int(0, 120)),
    created_at: daysAgoIso(int(120, 900)),
  };
}

// ---------- jobs ----------
function jobsSeed() {
  return [
    {
      title: 'Senior React Developer',
      status: 'active',
      skills: ['React', 'JavaScript', 'TypeScript', 'Redux', 'HTML', 'CSS', 'Jest'],
      min_exp: 3, max_exp: 7, min_salary: 14, max_salary: 26,
      locations: ['Bengaluru', 'Pune'], employment_type: 'Full Time', work_mode: 'Hybrid',
      education: 'B.Tech/B.E. in any specialization', industry: 'IT Services & Consulting', functional_area: 'Engineering - Software & QA',
      openings: 3, days: 6,
      description: `Brightwave Technologies is looking for a Senior React Developer to join the team building Brightwave Commerce Cloud, our multi-tenant storefront platform used by 400+ mid-market retailers across India and South-East Asia.

What you will do:
- Own large features end to end across our React + TypeScript storefront and merchant admin apps.
- Build reusable, accessible components for our internal design system and help evolve our state management (Redux Toolkit, React Query).
- Improve Core Web Vitals on high-traffic pages and keep bundle sizes in check.
- Write meaningful unit and integration tests with Jest and React Testing Library.
- Review code, mentor two to three junior engineers, and work closely with product and design.

What we are looking for:
- 3-7 years of professional frontend experience, at least 2 years with React.
- Strong fundamentals in JavaScript, HTML, CSS and browser rendering.
- Experience with TypeScript and Redux in a production codebase.
- Bonus: Next.js, micro-frontends, GraphQL, or experience on an e-commerce product.

Hybrid role - 3 days a week from our Bengaluru (Koramangala) or Pune (Baner) office.`,
    },
    {
      title: 'Java Backend Engineer',
      status: 'active',
      skills: ['Java', 'Spring Boot', 'Microservices', 'Kafka', 'SQL', 'AWS', 'Docker'],
      min_exp: 4, max_exp: 9, min_salary: 18, max_salary: 34,
      locations: ['Bengaluru', 'Hyderabad'], employment_type: 'Full Time', work_mode: 'Hybrid',
      education: 'B.Tech/B.E. or M.Tech in Computer Science', industry: 'IT Services & Consulting', functional_area: 'Engineering - Software & QA',
      openings: 4, days: 12,
      description: `We are hiring Java Backend Engineers for Brightwave Pay, the payments and settlements platform that processes over 2 million transactions a day for our merchants.

Responsibilities:
- Design, build and operate highly available microservices in Java 17 and Spring Boot.
- Build event-driven workflows on Kafka for payments, refunds and reconciliation.
- Model data in PostgreSQL/MySQL and write efficient SQL; use Redis for caching.
- Ship to AWS (EKS) through our CI/CD pipelines with Docker and Kubernetes.
- Participate in design reviews, on-call rotations and post-incident reviews.

Requirements:
- 4-9 years of backend development experience with Java and Spring Boot.
- Hands-on experience with microservices, messaging systems (Kafka/RabbitMQ) and relational databases.
- Good understanding of concurrency, API design and distributed systems trade-offs.
- Experience in fintech or payments is a strong plus.`,
    },
    {
      title: 'Data Scientist',
      status: 'active',
      skills: ['Python', 'Machine Learning', 'SQL', 'Statistics', 'Scikit-learn', 'Deep Learning', 'NLP'],
      min_exp: 2, max_exp: 6, min_salary: 15, max_salary: 30,
      locations: ['Bengaluru', 'Remote'], employment_type: 'Full Time', work_mode: 'Remote',
      education: 'B.Tech/M.Tech/M.Sc in CS, Statistics or Mathematics', industry: 'IT Services & Consulting', functional_area: 'Data Science & Analytics',
      openings: 2, days: 3,
      description: `The Brightwave Intelligence team builds the machine learning behind product recommendations, demand forecasting and fraud detection for our commerce and payments products.

As a Data Scientist you will:
- Frame business problems with product managers and translate them into ML solutions.
- Build, evaluate and deploy models (gradient boosting, deep learning, NLP) in Python.
- Design experiments and A/B tests and communicate results with rigorous statistics.
- Work with data engineers on features and with platform engineers on MLOps.

You should have:
- 2-6 years of hands-on data science experience shipping models to production.
- Strong Python, SQL and statistics; experience with scikit-learn and PyTorch or TensorFlow.
- Experience with NLP or recommendation systems is a plus. R is welcome but not required.

This is a fully remote role within India, with quarterly offsites in Bengaluru.`,
    },
    {
      title: 'DevOps Engineer',
      status: 'active',
      skills: ['AWS', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD', 'Linux', 'Prometheus'],
      min_exp: 3, max_exp: 8, min_salary: 14, max_salary: 28,
      locations: ['Pune', 'Hyderabad', 'Bengaluru'], employment_type: 'Full Time', work_mode: 'Office',
      education: 'B.Tech/B.E. in any specialization', industry: 'IT Services & Consulting', functional_area: 'IT & Information Security',
      openings: 2, days: 18,
      description: `Our Platform Engineering team runs 120+ microservices across AWS regions in Mumbai and Singapore. We are looking for a DevOps Engineer who loves automation and reliability.

You will:
- Manage AWS infrastructure as code with Terraform and maintain our EKS clusters.
- Build and improve CI/CD pipelines (GitHub Actions, ArgoCD) for fast, safe releases.
- Own observability: Prometheus, Grafana, Loki and alerting tuned for low noise.
- Drive cost optimisation and security hardening (IAM, secrets, network policies).
- Be part of a lightweight on-call rotation and lead blameless post-mortems.

You bring:
- 3-8 years in DevOps/SRE roles with strong Linux and networking fundamentals.
- Production experience with Docker, Kubernetes and at least one major cloud (AWS preferred).
- Scripting in Bash or Python.`,
    },
    {
      title: 'QA Automation Engineer',
      status: 'active',
      skills: ['Selenium', 'Java', 'TestNG', 'API Testing', 'Rest Assured', 'Jenkins', 'Test Automation'],
      min_exp: 2, max_exp: 6, min_salary: 8, max_salary: 16,
      locations: ['Noida', 'Gurugram', 'Pune'], employment_type: 'Full Time', work_mode: 'Hybrid',
      education: 'B.Tech/B.E./MCA', industry: 'IT Services & Consulting', functional_area: 'Engineering - Software & QA',
      openings: 3, days: 9,
      description: `We are expanding our Quality Engineering team and need QA Automation Engineers who can build and own test automation for web and API layers.

Key responsibilities:
- Build and maintain a Selenium + TestNG automation framework (Java, Page Object Model).
- Automate REST API tests with Rest Assured and integrate suites into Jenkins CI/CD.
- Collaborate with developers during sprint planning to define acceptance criteria.
- Track defects in JIRA and publish quality dashboards for each release.

Requirements:
- 2-6 years of QA experience with at least 2 years in automation.
- Strong Java fundamentals for writing maintainable test code.
- Experience with API testing tools (Postman, Rest Assured) and CI tools (Jenkins).
- Good to have: Cypress or Playwright, performance testing with JMeter.`,
    },
    {
      title: 'Android Developer (Kotlin)',
      status: 'draft',
      skills: ['Android', 'Kotlin', 'Jetpack Compose', 'MVVM', 'Coroutines', 'Retrofit'],
      min_exp: 2, max_exp: 5, min_salary: 10, max_salary: 20,
      locations: ['Bengaluru'], employment_type: 'Full Time', work_mode: 'Office',
      education: 'B.Tech/B.E. in Computer Science', industry: 'IT Services & Consulting', functional_area: 'Engineering - Software & QA',
      openings: 1, days: 1,
      description: `Draft - pending budget approval.

We are building Brightwave Merchant, an Android app that lets small retailers manage inventory, collect payments and track orders on the go.

You will:
- Build new features in Kotlin with Jetpack Compose and MVVM.
- Work on offline-first sync, background work and performance.
- Collaborate with backend engineers on API contracts.

You should have 2-5 years of Android development experience, strong Kotlin skills, and apps live on the Play Store.`,
    },
    {
      title: 'Product Manager - Payments',
      status: 'closed',
      skills: ['Product Management', 'Product Strategy', 'Roadmapping', 'SQL', 'A/B Testing', 'Stakeholder Management'],
      min_exp: 4, max_exp: 9, min_salary: 25, max_salary: 45,
      locations: ['Bengaluru', 'Mumbai'], employment_type: 'Full Time', work_mode: 'Hybrid',
      education: 'MBA preferred; engineering background a plus', industry: 'FinTech / Payments', functional_area: 'Product Management',
      openings: 1, days: 55,
      description: `Position filled - thank you to everyone who applied.

Brightwave Pay is looking for a Product Manager to own merchant payments experience: checkout, payment links, settlements and refunds.

Responsibilities:
- Own the payments roadmap and define success metrics with leadership.
- Work with engineering, design, risk and compliance to ship high-quality features.
- Use data (SQL, dashboards, experiments) to prioritise and measure impact.

Requirements:
- 4-9 years of product management experience, ideally in fintech or B2B SaaS.
- Strong analytical skills and comfort with SQL.
- Excellent written communication and stakeholder management.`,
    },
    {
      title: 'HR Executive - Talent Acquisition',
      status: 'closed',
      skills: ['Recruitment', 'Talent Acquisition', 'Sourcing', 'Screening', 'Onboarding', 'MS Excel'],
      min_exp: 1, max_exp: 4, min_salary: 3.5, max_salary: 7,
      locations: ['Bengaluru'], employment_type: 'Full Time', work_mode: 'Office',
      education: 'MBA/PGDM in HR', industry: 'IT Services & Consulting', functional_area: 'Human Resources',
      openings: 2, days: 40,
      description: `We were hiring HR Executives to support our fast-growing engineering teams. This position is now closed.

Role:
- Manage the full recruitment cycle for tech and non-tech roles: sourcing on job portals and LinkedIn, screening, scheduling interviews and closing offers.
- Coordinate onboarding and induction for new joiners.
- Maintain trackers and MIS reports in MS Excel and our ATS.

Requirements:
- 1-4 years of recruitment experience, preferably in an IT company.
- MBA/PGDM in HR.
- Excellent communication and coordination skills.`,
    },
  ];
}

function seed({ quiet = false } = {}) {
  rand = mulberry32(20241028);
  const log = quiet ? () => {} : console.log;

  dropAll();
  init();

  const summary = transaction(() => {
    const rec = db
      .prepare(
        `INSERT INTO recruiters (id, name, email, phone, designation, company_name, company_website, company_size, industry, location, about, avatar_url, hiring_for, created_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'Ananya Iyer',
        'ananya.iyer@brightwave.example',
        '+91 98450 21734',
        'Senior Talent Acquisition Partner',
        'Brightwave Technologies',
        'https://brightwave.example',
        '501-1000 employees',
        'IT Services & Consulting',
        'Bengaluru',
        'Brightwave Technologies builds commerce and payments software for mid-market retailers across India and South-East Asia. Founded in 2014 and headquartered in Koramangala, Bengaluru, we have engineering centres in Pune and Hyderabad. I lead technology hiring for our Commerce Cloud, Payments and Data teams.',
        '',
        toJson(['React Developer', 'Java Backend Engineer', 'Data Scientist', 'DevOps Engineer', 'QA Automation Engineer', 'Android Developer']),
        daysAgoIso(400, false)
      );
    void rec;

    const insJob = db.prepare(
      `INSERT INTO jobs (recruiter_id, title, description, skills, min_exp, max_exp, min_salary, max_salary, locations, employment_type, work_mode, education, industry, functional_area, openings, status, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const jobIds = [];
    for (const j of jobsSeed()) {
      const created = daysAgoIso(j.days);
      const updated = j.status === 'closed' ? daysAgoIso(Math.max(1, j.days - 25)) : created;
      const r = insJob.run(j.title, j.description, toJson(j.skills), j.min_exp, j.max_exp, j.min_salary, j.max_salary, toJson(j.locations), j.employment_type, j.work_mode, j.education, j.industry, j.functional_area, j.openings, j.status, created, updated);
      jobIds.push(Number(r.lastInsertRowid));
    }

    const insCand = db.prepare(
      `INSERT INTO candidates (name, email, phone, headline, current_title, current_company, location, preferred_locations, experience_years, current_ctc, expected_ctc, notice_period_days, skills, education, resume_text, gender, last_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const usedEmails = new Set();
    const families = Object.entries(FAMILIES);
    const candidates = [];
    for (const [key, fam] of families) for (let i = 0; i < fam.count; i++) candidates.push(makeCandidate(key, fam, i, usedEmails));
    // interleave deterministically so ids aren't grouped by family
    const shuffled = sample(candidates, candidates.length);
    const candIds = [];
    for (const c of shuffled) {
      const r = insCand.run(c.name, c.email, c.phone, c.headline, c.current_title, c.current_company, c.location, toJson(c.preferred_locations), c.experience_years, c.current_ctc, c.expected_ctc, c.notice_period_days, toJson(c.skills), c.education, c.resume_text, c.gender, c.last_active, c.created_at);
      candIds.push({ id: Number(r.lastInsertRowid), c });
    }

    // shortlists: pick candidates whose skills overlap the job
    const insSl = db.prepare('INSERT INTO shortlists (recruiter_id, job_id, candidate_id, note, created_at) VALUES (1, ?, ?, ?, ?)');
    const notes = ['Strong profile, schedule technical round', 'Good communication on screening call', 'Check notice period buyout', 'Referred by engineering manager', 'Salary expectations slightly high', 'Shortlisted for hiring manager review', ''];
    const jobs = jobsSeed();
    let slCount = 0;
    [0, 1, 2, 3, 4, 6].forEach((jIdx, n) => {
      const job = jobs[jIdx];
      const fits = candIds.filter(({ c }) => job.skills.filter((s) => c.skills.includes(s)).length >= Math.min(3, job.skills.length - 1));
      for (const { id } of sample(fits, n % 2 === 0 ? 3 : 2)) {
        insSl.run(jobIds[jIdx], id, pick(notes), daysAgoIso(int(0, 20)));
        slCount++;
      }
    });
    // a couple of general (no job) shortlists
    for (const { id } of sample(candIds, 2)) {
      insSl.run(null, id, 'Keep in talent pool for future roles', daysAgoIso(int(0, 30)));
      slCount++;
    }

    const famCounts = Object.fromEntries(families.map(([k, f]) => [k, f.count]));
    return { jobs: jobIds.length, candidates: candIds.length, shortlists: slCount, famCounts };
  });

  log('Seeded TalentDesk database:');
  log(`  recruiter : 1 (Ananya Iyer, Brightwave Technologies, Bengaluru)`);
  log(`  jobs      : ${summary.jobs}`);
  const st = db.prepare('SELECT status, COUNT(*) n FROM jobs GROUP BY status').all();
  log(`              ${st.map((r) => `${r.status}=${r.n}`).join(', ')}`);
  log(`  candidates: ${summary.candidates}  (${Object.entries(summary.famCounts).map(([k, v]) => `${k} ${v}`).join(', ')})`);
  log(`  shortlists: ${summary.shortlists}`);
  return summary;
}

module.exports = { seed };

if (require.main === module) {
  seed();
}
