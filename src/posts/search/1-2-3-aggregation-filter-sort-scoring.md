---
title: 聚合、过滤、排序与评分：搜索与分析系统的核心操作机制
date: 2025-08-30
categories: [Search]
tags: [search, data-analysis]
published: true
---

在搜索与数据分析中间件中，聚合、过滤、排序和评分是四大核心操作机制。它们决定了如何处理、分析和呈现数据，是构建高效搜索和分析系统的关键技术。本文将深入探讨这些机制的技术原理、实现方式和实际应用。

## 聚合：数据分析的利器

### 聚合的概念与分类

聚合是对数据进行分组计算的操作，类似于SQL中的GROUP BY和聚合函数。在搜索与分析系统中，聚合提供了强大的数据分析能力。

#### 聚合的分类

1. **Bucket聚合**：将文档分组到不同的"桶"中
2. **Metric聚合**：对字段进行计算，如求和、平均值等
3. **Pipeline聚合**：对其他聚合的结果进行再计算

### Bucket聚合详解

Bucket聚合将文档分组到不同的桶中，每个桶关联一个条件。

#### Terms聚合

```json
{
  "aggs": {
    "product_categories": {
      "terms": {
        "field": "category.keyword",
        "size": 10
      }
    }
  }
}
```

#### Range聚合

```json
{
  "aggs": {
    "price_ranges": {
      "range": {
        "field": "price",
        "ranges": [
          { "to": 1000 },
          { "from": 1000, "to": 5000 },
          { "from": 5000 }
        ]
      }
    }
  }
}
```

#### Date Histogram聚合

```json
{
  "aggs": {
    "sales_over_time": {
      "date_histogram": {
        "field": "sale_date",
        "calendar_interval": "day"
      }
    }
  }
}
```

#### Histogram聚合

```json
{
  "aggs": {
    "price_histogram": {
      "histogram": {
        "field": "price",
        "interval": 1000
      }
    }
  }
}
```

### Metric聚合详解

Metric聚合对字段进行计算，返回具体的数值结果。

#### 基础Metric聚合

```json
{
  "aggs": {
    "avg_price": {
      "avg": {
        "field": "price"
      }
    },
    "max_price": {
      "max": {
        "field": "price"
      }
    },
    "min_price": {
      "min": {
        "field": "price"
      }
    },
    "sum_quantity": {
      "sum": {
        "field": "quantity"
      }
    }
  }
}
```

#### Cardinality聚合

```json
{
  "aggs": {
    "unique_brands": {
      "cardinality": {
        "field": "brand.keyword"
      }
    }
  }
}
```

#### Stats聚合

```json
{
  "aggs": {
    "price_stats": {
      "stats": {
        "field": "price"
      }
    }
  }
}
```

### Pipeline聚合详解

Pipeline聚合对其他聚合的结果进行再计算。

#### Derivative聚合

```json
{
  "aggs": {
    "sales_per_month": {
      "date_histogram": {
        "field": "date",
        "calendar_interval": "month"
      },
      "aggs": {
        "sales": {
          "sum": {
            "field": "amount"
          }
        }
      }
    },
    "sales_deriv": {
      "derivative": {
        "buckets_path": "sales_per_month>sales"
      }
    }
  }
}
```

#### Moving Average聚合

```json
{
  "aggs": {
    "sales_per_day": {
      "date_histogram": {
        "field": "date",
        "calendar_interval": "day"
      },
      "aggs": {
        "daily_sales": {
          "sum": {
            "field": "amount"
          }
        }
      }
    },
    "moving_avg": {
      "moving_avg": {
        "buckets_path": "sales_per_day>daily_sales",
        "window": 7
      }
    }
  }
}
```

### 复杂聚合示例

```json
{
  "size": 0,
  "aggs": {
    "categories": {
      "terms": {
        "field": "category.keyword",
        "size": 10
      },
      "aggs": {
        "avg_price": {
          "avg": {
            "field": "price"
          }
        },
        "price_ranges": {
          "range": {
            "field": "price",
            "ranges": [
              { "to": 1000, "key": "低价位" },
              { "from": 1000, "to": 5000, "key": "中价位" },
              { "from": 5000, "key": "高价位" }
            ]
          },
          "aggs": {
            "avg_rating": {
              "avg": {
                "field": "rating"
              }
            }
          }
        }
      }
    }
  }
}
```

## 过滤：精确匹配的关键

### 过滤的概念与特点

过滤用于精确匹配文档，不计算相关性评分。过滤结果可以被缓存，因此具有很高的性能。

#### 过滤与查询的区别

| 特性 | 过滤(Filter) | 查询(Query) |
|------|-------------|-------------|
| 相关性评分 | 不计算 | 计算 |
| 结果缓存 | 可缓存 | 不缓存 |
| 性能 | 高 | 相对较低 |
| 适用场景 | 精确匹配 | 相关性检索 |

### 常用过滤器

#### Term过滤器

```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "status": "published"
          }
        }
      ]
    }
  }
}
```

#### Terms过滤器

```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "terms": {
            "category.keyword": ["电子产品", "家居用品"]
          }
        }
      ]
    }
  }
}
```

#### Range过滤器

```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "range": {
            "price": {
              "gte": 1000,
              "lte": 5000
            }
          }
        }
      ]
    }
  }
}
```

#### Exists过滤器

```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "exists": {
            "field": "discount"
          }
        }
      ]
    }
  }
}
```

#### Bool过滤器

```json
{
  "query": {
    "bool": {
      "filter": [
        {
          "term": {
            "category.keyword": "电子产品"
          }
        },
        {
          "range": {
            "price": {
              "gte": 1000
            }
          }
        },
        {
          "exists": {
            "field": "discount"
          }
        }
      ]
    }
  }
}
```

### 过滤器的性能优化

#### 1. 使用过滤器上下文

```json
// 推荐：使用filter上下文
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "published" } },
        { "range": { "publish_date": { "gte": "2025-01-01" } } }
      ]
    }
  }
}

// 不推荐：使用query上下文
{
  "query": {
    "bool": {
      "must": [
        { "term": { "status": "published" } },
        { "range": { "publish_date": { "gte": "2025-01-01" } } }
      ]
    }
  }
}
```

#### 2. 合理使用过滤器顺序

```json
{
  "query": {
    "bool": {
      "filter": [
        // 选择性高的过滤器放在前面
        { "term": { "category.keyword": "热门分类" } },
        { "range": { "view_count": { "gte": 10000 } } },
        { "term": { "status": "published" } }
      ]
    }
  }
}
```

## 排序：结果呈现的艺术

### 排序的基本概念

排序决定了查询结果的排列顺序，可以基于字段值、相关性评分或自定义脚本。

### 排序方式详解

#### 1. 按字段排序

```json
{
  "query": {
    "match": {
      "title": "机器学习"
    }
  },
  "sort": [
    {
      "publish_date": {
        "order": "desc"
      }
    },
    {
      "view_count": {
        "order": "desc"
      }
    }
  ]
}
```

#### 2. 按相关性排序

```json
{
  "query": {
    "match": {
      "title": "机器学习"
    }
  },
  "sort": [
    {
      "_score": {
        "order": "desc"
      }
    }
  ]
}
```

#### 3. 按脚本排序

```json
{
  "query": {
    "match_all": {}
  },
  "sort": [
    {
      "_script": {
        "type": "number",
        "script": {
          "lang": "painless",
          "source": "doc['view_count'].value * params.factor",
          "params": {
            "factor": 1.2
          }
        },
        "order": "desc"
      }
    }
  ]
}
```

#### 4. 按地理位置排序

```json
{
  "query": {
    "match_all": {}
  },
  "sort": [
    {
      "_geo_distance": {
        "location": {
          "lat": 39.9042,
          "lon": 116.4074
        },
        "order": "asc",
        "unit": "km"
      }
    }
  ]
}
```

### 多字段排序

```json
{
  "query": {
    "match": {
      "content": "数据分析"
    }
  },
  "sort": [
    {
      "_score": {
        "order": "desc"
      }
    },
    {
      "publish_date": {
        "order": "desc"
      }
    },
    {
      "view_count": {
        "order": "desc"
      }
    }
  ]
}
```

### 排序优化技巧

#### 1. 使用missing参数处理空值

```json
{
  "sort": [
    {
      "discount": {
        "order": "desc",
        "missing": "_last"
      }
    }
  ]
}
```

#### 2. 使用unmapped_type处理未映射字段

```json
{
  "sort": [
    {
      "unknown_field": {
        "order": "desc",
        "unmapped_type": "long"
      }
    }
  ]
}
```

## 评分：相关性计算的核心

### 评分的基本原理

评分用于衡量文档与查询的相关性程度，是搜索系统的核心算法之一。

### 评分算法详解

#### 1. TF-IDF算法

TF-IDF（Term Frequency-Inverse Document Frequency）是经典的评分算法：

```
TF-IDF = TF(t,d) × IDF(t)
其中：
- TF(t,d) 是词t在文档d中的词频
- IDF(t) 是词t的逆文档频率
```

#### 2. BM25算法

BM25是现代搜索引擎广泛使用的评分算法：

```
BM25 = IDF(qi) × (fi × (k1+1)) / (fi + k1)
其中：
- IDF(qi) 是词qi的逆文档频率
- fi 是词qi在文档中的词频
- k1 是饱和参数
```

### 自定义评分

#### 1. Function Score查询

```json
{
  "query": {
    "function_score": {
      "query": {
        "match": {
          "title": "机器学习"
        }
      },
      "functions": [
        {
          "filter": {
            "term": {
              "category.keyword": "热门推荐"
            }
          },
          "weight": 2
        },
        {
          "field_value_factor": {
            "field": "view_count",
            "modifier": "log1p",
            "factor": 0.1
          }
        },
        {
          "gauss": {
            "publish_date": {
              "origin": "now",
              "scale": "30d",
              "offset": "7d",
              "decay": 0.5
            }
          }
        }
      ],
      "score_mode": "sum",
      "boost_mode": "multiply"
    }
  }
}
```

#### 2. Script Score查询

```json
{
  "query": {
    "script_score": {
      "query": {
        "match": {
          "title": "数据分析"
        }
      },
      "script": {
        "source": "Math.log(doc['view_count'].value + 1) * params.factor",
        "params": {
          "factor": 1.2
        }
      }
    }
  }
}
```

### 评分优化策略

#### 1. 使用boost参数

```json
{
  "query": {
    "bool": {
      "should": [
        {
          "match": {
            "title": {
              "query": "机器学习",
              "boost": 2.0
            }
          }
        },
        {
          "match": {
            "content": {
              "query": "机器学习",
              "boost": 1.0
            }
          }
        }
      ]
    }
  }
}
```

#### 2. 使用constant_score查询

```json
{
  "query": {
    "constant_score": {
      "filter": {
        "term": {
          "category.keyword": "推荐"
        }
      },
      "boost": 1.5
    }
  }
}
```

## 实际应用案例

### 电商搜索系统

```json
{
  "query": {
    "function_score": {
      "query": {
        "bool": {
          "must": [
            {
              "multi_match": {
                "query": "iPhone",
                "fields": ["name^2", "description"]
              }
            }
          ],
          "filter": [
            {
              "term": {
                "status": "in_stock"
              }
            }
          ]
        }
      },
      "functions": [
        {
          "filter": {
            "range": {
              "rating": {
                "gte": 4.5
              }
            }
          },
          "weight": 2
        },
        {
          "field_value_factor": {
            "field": "sales_count",
            "modifier": "log1p",
            "factor": 0.1
          }
        }
      ],
      "score_mode": "sum",
      "boost_mode": "multiply"
    }
  },
  "sort": [
    {
      "_score": {
        "order": "desc"
      }
    },
    {
      "sales_count": {
        "order": "desc"
      }
    }
  ]
}
```

### 内容推荐系统

```json
{
  "size": 0,
  "aggs": {
    "user_interests": {
      "terms": {
        "field": "tags.keyword",
        "size": 20
      }
    },
    "popular_categories": {
      "terms": {
        "field": "category.keyword",
        "size": 10
      },
      "aggs": {
        "avg_rating": {
          "avg": {
            "field": "rating"
          }
        }
      }
    }
  }
}
```

## 性能优化建议

### 1. 合理使用聚合

```json
// 限制聚合结果数量
{
  "aggs": {
    "categories": {
      "terms": {
        "field": "category.keyword",
        "size": 100  // 避免过大的size
      }
    }
  }
}
```

### 2. 优化过滤器使用

```json
// 使用过滤器上下文提高性能
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "status": "published" } }
      ],
      "must": [
        { "match": { "title": "机器学习" } }
      ]
    }
  }
}
```

### 3. 合理设计排序策略

```json
// 避免对高基数字段进行排序
{
  "sort": [
    { "publish_date": { "order": "desc" } },  // 低基数字段
    { "_score": { "order": "desc" } }         // 相关性评分
    // 避免对user_id等高基数字段排序
  ]
}
```

## 小结

聚合、过滤、排序和评分是搜索与分析系统的核心操作机制。聚合提供了强大的数据分析能力，过滤实现了高效的精确匹配，排序决定了结果的呈现方式，评分则衡量了文档的相关性。

在实际应用中，我们需要根据具体的业务需求合理组合这些机制，并通过优化策略提升系统性能。随着技术的发展，还出现了向量评分、语义评分等新技术，为相关性计算提供了更多可能性。

掌握这些核心操作机制，对于构建高性能、高准确性的搜索与分析系统至关重要。通过深入理解其技术原理和实现方式，我们可以设计出更加优秀的数据处理解决方案。