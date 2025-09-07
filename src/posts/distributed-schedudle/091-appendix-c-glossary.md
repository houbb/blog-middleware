---
title: "附录C: 术语表"
date: 2025-09-06
categories: [DistributedSchedule]
tags: [DistributedSchedule]
published: true
---
在分布式调度平台的设计、开发、部署和运维过程中，涉及众多专业术语和技术概念。为了帮助读者更好地理解和使用本书内容，本附录提供了相关术语的定义和解释。术语按照字母顺序排列，涵盖了分布式系统、调度平台、云计算、容器化等相关领域的核心概念。

## A

**API (Application Programming Interface)**
应用程序编程接口，定义了软件组件之间交互的规范和协议。在调度平台中，API用于任务提交、状态查询、配置管理等功能。

**ACL (Access Control List)**
访问控制列表，用于定义哪些用户或系统可以访问特定资源或执行特定操作的安全机制。

**ACID**
数据库事务的四个基本特性：原子性（Atomicity）、一致性（Consistency）、隔离性（Isolation）、持久性（Durability）。

**Alarm**
告警系统，用于监控系统状态并在检测到异常时发送通知。

## B

**Backfill**
回填，指重新运行历史时间段内的任务，通常用于修复数据或重新处理数据。

**Batch Processing**
批处理，指将一组任务或数据集中处理的计算模式，通常在非实时场景下使用。

## C

**CAP Theorem**
CAP定理，指出在分布式系统中，一致性（Consistency）、可用性（Availability）、分区容错性（Partition Tolerance）三者不可兼得，最多只能同时满足其中两个。

**Chaos Engineering**
混沌工程，一种通过在生产环境中进行受控实验来提高系统韧性的实践方法。

**CI/CD (Continuous Integration/Continuous Deployment)**
持续集成/持续部署，软件开发实践，通过自动化构建、测试和部署流程来提高软件交付效率和质量。

**CLI (Command Line Interface)**
命令行界面，通过文本命令与计算机程序交互的用户界面。

**Cloud Native**
云原生，一种构建和运行应用程序的方法，充分利用云计算的弹性、可扩展性和分布式特性。

**Cron**
Unix/Linux系统中的定时任务调度工具，用于按预定时间执行命令或脚本。

**Cgroups (Control Groups)**
Linux内核功能，用于限制、记录和隔离进程组的资源使用（CPU、内存、磁盘I/O等）。

## D

**DAG (Directed Acyclic Graph)**
有向无环图，在调度平台中用于表示任务间依赖关系的工作流模型。

**Data Lake**
数据湖，存储企业各种原始数据的系统或存储库，支持多种数据格式和分析方法。

**Data Warehouse**
数据仓库，用于存储和管理大量结构化数据，支持复杂的查询和分析操作。

**Docker**
开源容器化平台，用于打包、分发和运行应用程序及其依赖项。

## E

**ETL (Extract, Transform, Load)**
数据抽取、转换、加载，数据仓库中的核心处理流程。

**Event-Driven Architecture**
事件驱动架构，一种软件架构模式，组件通过事件进行异步通信。

## F

**FaaS (Function as a Service)**
函数即服务，一种云计算服务模型，允许开发者运行代码片段而无需管理底层基础设施。

**Fair Scheduling**
公平调度，一种资源分配策略，确保所有用户或任务公平地共享系统资源。

**Fault Tolerance**
容错性，系统在部分组件发生故障时仍能继续正常运行的能力。

## G

**gRPC**
Google开发的高性能、开源通用RPC框架，基于HTTP/2协议。

**GPU (Graphics Processing Unit)**
图形处理单元，专门用于处理图形和并行计算任务的硬件组件。

## H

**HA (High Availability)**
高可用性，系统能够长时间持续提供服务的能力，通常通过冗余设计实现。

**HPA (Horizontal Pod Autoscaler)**
水平Pod自动伸缩器，Kubernetes中的功能，根据资源使用情况自动调整Pod副本数量。

## I

**IAM (Identity and Access Management)**
身份和访问管理，用于管理用户身份和控制资源访问权限的框架。

**IaC (Infrastructure as Code)**
基础设施即代码，通过代码定义和管理计算基础设施的方法。

**Idempotent**
幂等性，指操作可以多次执行而不会产生不同的结果。

**IOPS (Input/Output Operations Per Second)**
每秒输入/输出操作数，衡量存储设备性能的指标。

## J

**Job**
任务，在调度平台中指需要执行的工作单元。

**JSON (JavaScript Object Notation)**
一种轻量级的数据交换格式，易于人阅读和编写，也易于机器解析和生成。

## K

**Kubernetes**
开源容器编排平台，用于自动化部署、扩展和管理容器化应用程序。

**KPI (Key Performance Indicator)**
关键绩效指标，用于衡量组织、部门或个人在关键业务目标上表现的可量化的指标。

## L

**Leader Election**
领导者选举，在分布式系统中选择一个节点作为主节点的机制。

**Load Balancing**
负载均衡，将工作负载分配到多个计算资源上的过程，以优化资源使用和最大化吞吐量。

## M

**Master-Worker Pattern**
主从模式，一种分布式计算架构，其中一个主节点协调多个工作节点执行任务。

**Microservices**
微服务，一种软件架构风格，将应用程序构建为一组小型、独立的服务。

**MQ (Message Queue)**
消息队列，用于在应用程序组件之间传递消息的中间件。

## N

**Namespace**
命名空间，用于组织和隔离资源的逻辑分组。

**NewSQL**
新一代关系型数据库，结合了NoSQL的可扩展性和传统SQL数据库的ACID特性。

## O

**OAuth**
开放授权标准，允许用户授权第三方应用访问其资源而无需共享密码。

**Observability**
可观察性，指通过系统的输出（日志、指标、追踪）来理解系统内部状态的能力。

**OpenAPI**
开放API规范，用于描述RESTful API的标准格式。

## P

**PaaS (Platform as a Service)**
平台即服务，云计算服务模型，提供应用程序开发和部署平台。

**Partition Tolerance**
分区容错性，在网络分区发生时系统继续运行的能力。

**Pod**
Kubernetes中的最小部署单元，包含一个或多个容器。

**Prometheus**
开源系统监控和告警工具包。

## Q

**Quorum**
法定人数，在分布式系统中达成一致所需的最小节点数。

## R

**Raft**
一种用于管理复制日志的一致性算法，设计目标是易于理解。

**RBAC (Role-Based Access Control)**
基于角色的访问控制，根据用户角色分配权限的安全模型。

**REST (Representational State Transfer)**
表述性状态转移，一种软件架构风格，用于设计网络应用程序的API。

**RPC (Remote Procedure Call)**
远程过程调用，一种通信协议，允许程序执行位于不同地址空间的子程序。

## S

**SaaS (Software as a Service)**
软件即服务，云计算服务模型，通过互联网提供软件应用程序。

**Scheduling**
调度，在分布式系统中决定何时以及在何处执行任务的过程。

**Serverless**
无服务器计算，一种云计算执行模型，云提供商动态管理机器资源的分配。

**SLA (Service Level Agreement)**
服务等级协议，服务提供商和客户之间关于服务质量的正式承诺。

**SLO (Service Level Objective)**
服务等级目标，SLA中具体的、可测量的服务质量目标。

**SLI (Service Level Indicator)**
服务等级指标，用于衡量服务是否达到SLO的具体测量值。

**Sandbox**
沙箱，一种安全机制，为运行程序提供隔离环境。

**Scaling**
扩展，根据需求增加或减少计算资源的过程。

**SDK (Software Development Kit)**
软件开发工具包，为开发特定软件提供的一组工具和文档。

**SLI (Service Level Indicator)**
服务等级指标，用于衡量服务是否达到SLO的具体测量值。

**SLO (Service Level Objective)**
服务等级目标，SLA中具体的、可测量的服务质量目标。

**SRE (Site Reliability Engineering)**
站点可靠性工程，一种IT运营工作方法，强调通过软件工程方法解决运维问题。

## T

**Task**
任务，在调度平台中指需要执行的工作单元，可以是作业的一部分。

**Time Wheel**
时间轮，一种高效处理定时任务的数据结构。

**Tracing**
追踪，在分布式系统中跟踪请求在各个服务间的流转过程。

## U

**UI (User Interface)**
用户界面，用户与系统交互的界面。

**Uptime**
正常运行时间，系统在指定时间段内正常运行的时间比例。

**UUID (Universally Unique Identifier)**
通用唯一标识符，用于在分布式环境中唯一标识信息的128位数字。

## V

**Vertical Scaling**
垂直扩展，通过增加单个服务器的资源（CPU、内存等）来提高性能。

## W

**Worker**
工作节点，在分布式系统中执行实际任务的组件。

**Workflow**
工作流，一系列相互关联的任务，按照预定义的顺序执行。

## X

**XaaS (Anything as a Service)**
一切即服务，云计算服务模型的统称，包括IaaS、PaaS、SaaS等。

## Y

**YAML (YAML Ain't Markup Language)**
一种人类可读的数据序列化标准，常用于配置文件。

## Z

**ZooKeeper**
开源分布式协调服务，用于维护配置信息、命名、提供分布式同步等。

---

*本术语表将持续更新，以涵盖分布式调度平台领域的最新概念和技术。*