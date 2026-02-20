Amit Seal Ami is researching Security and Software Engineering as Ph.D. Candidate at the [Computer Science Department](https://www.wm.edu/as/computerscience/), [William & Mary](https://www.wm.edu). He is Co-advised by [Dr. Adwait Nadkarni](https://www.adwaitnadkarni.com/) and [Dr. Denys Poshyvanyk](http://www.cs.wm.edu/~denys/), as part of the [SPL](https://spl-wm.github.io/) and [SEMERU](http://www.cs.wm.edu/semeru/) research groups.

Using software engineering research techniques, he creates systematic evaluation frameworks that can help improve security focused techniques or software.

## News Highlights

<ul>
    {% for news in site.data.news %}
        {% if news.activities %} {% continue %} {% endif %}
        {% if news.important %}
            <li> {{ news.description | markdownify | remove: '<p>' | remove: '</p>'  }}</li>
        {% endif %}
    {% endfor %}
</ul>

[[*Full list of News*]](/news)

## Activities Highlights

<ul>
    {% for news in site.data.news %}
        {% if news.activities %}
                {% if news.important %}
                    <li> {{ news.description | markdownify | remove: '<p>' | remove: '</p>'  }}</li>
            {% endif %}
        {% endif %}
    {% endfor %}
</ul>
[[*Full list of Activities*]](/news)