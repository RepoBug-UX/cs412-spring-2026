# Name: Gabriel Ginsberg
# Email: gginsber@bu.edu
# Description: Views for the voter_analytics app: a filterable voter list,
#              a voter detail page, and a graphs page using Plotly.

from django.views.generic import ListView, DetailView
from django.db.models import Count
from .models import Voter
import plotly.graph_objects as go


class VoterFilterMixin:
    """
    @notice Mixin that provides shared filtering logic for voter views.
    @dev Both VoterListView and VoterGraphsView inherit this to avoid code duplication.
         Reads GET parameters: party, min_birth_year, max_birth_year, voter_score,
         v20state, v21town, v21primary, v22general, v23town.
    """

    def get_filtered_queryset(self):
        """
        @notice Returns a queryset of Voter objects filtered by current GET parameters.
        @return Filtered QuerySet of Voter objects.
        """
        qs = Voter.objects.all()
        params = self.request.GET

        party = params.get('party', '')
        if party:
            qs = qs.filter(party_affiliation=party)

        min_birth_year = params.get('min_birth_year', '')
        if min_birth_year:
            qs = qs.filter(date_of_birth__year__gte=int(min_birth_year))

        max_birth_year = params.get('max_birth_year', '')
        if max_birth_year:
            qs = qs.filter(date_of_birth__year__lte=int(max_birth_year))

        voter_score = params.get('voter_score', '')
        if voter_score:
            qs = qs.filter(voter_score=int(voter_score))

        for field in ['v20state', 'v21town', 'v21primary', 'v22general', 'v23town']:
            if params.get(field):
                qs = qs.filter(**{field: True})

        return qs

    def get_filter_context(self):
        """
        @notice Returns context data needed to render and pre-populate the filter form.
        @return Dict with parties, years, scores, and current GET param values.
        """
        params = self.request.GET
        parties = Voter.objects.values_list('party_affiliation', flat=True).distinct().order_by('party_affiliation')

        return {
            'parties': parties,
            'years': range(1920, 2007),
            'scores': range(0, 6),
            'selected_party': params.get('party', ''),
            'selected_min_birth_year': params.get('min_birth_year', ''),
            'selected_max_birth_year': params.get('max_birth_year', ''),
            'selected_voter_score': params.get('voter_score', ''),
            'v20state_checked': params.get('v20state', ''),
            'v21town_checked': params.get('v21town', ''),
            'v21primary_checked': params.get('v21primary', ''),
            'v22general_checked': params.get('v22general', ''),
            'v23town_checked': params.get('v23town', ''),
        }


class VoterListView(VoterFilterMixin, ListView):
    """
    @notice Displays a paginated, filterable list of all registered voters.
    @dev URL: '' (name='voters'). Paginated at 100 records per page.
    """

    model = Voter
    template_name = 'voter_analytics/voters.html'
    context_object_name = 'voters'
    paginate_by = 100

    def get_queryset(self):
        """
        @notice Returns the filtered voter queryset for the list view.
        @return Filtered QuerySet of Voter objects.
        """
        return self.get_filtered_queryset()

    def get_context_data(self, **kwargs):
        """
        @notice Adds filter form data to the template context.
        @return Context dict with voter list, pagination, and filter state.
        """
        context = super().get_context_data(**kwargs)
        context.update(self.get_filter_context())
        return context


class VoterDetailView(DetailView):
    """
    @notice Displays all fields for a single voter, plus a Google Maps link.
    @dev URL: 'voter/<int:pk>' (name='voter').
    """

    model = Voter
    template_name = 'voter_analytics/voter.html'
    context_object_name = 'voter'


class VoterGraphsView(VoterFilterMixin, ListView):
    """
    @notice Displays three Plotly charts summarising voter data, with filter support.
    @dev URL: 'graphs' (name='graphs').
         Charts: birth year histogram, party affiliation pie, election participation histogram.
         Filtering reuses VoterFilterMixin, same as VoterListView.
    """

    model = Voter
    template_name = 'voter_analytics/graphs.html'
    context_object_name = 'voters'

    def get_queryset(self):
        """
        @notice Returns the filtered voter queryset for the graphs view.
        @return Filtered QuerySet of Voter objects.
        """
        return self.get_filtered_queryset()

    def get_context_data(self, **kwargs):
        """
        @notice Builds Plotly charts from filtered data and adds them to context.
        @dev Uses fig.to_html(full_html=False) to get embeddable div strings.
        @return Context dict with three graph HTML strings and filter state.
        """
        context = super().get_context_data(**kwargs)
        context.update(self.get_filter_context())

        qs = self.get_filtered_queryset()

        # --- Chart 1: Birth year histogram ---
        birth_data = (
            qs.values('date_of_birth__year')
            .annotate(count=Count('id'))
            .order_by('date_of_birth__year')
        )
        birth_years = [d['date_of_birth__year'] for d in birth_data]
        birth_counts = [d['count'] for d in birth_data]

        fig1 = go.Figure(data=[go.Bar(x=birth_years, y=birth_counts)])
        fig1.update_layout(
            title='',
            xaxis_title='Year of Birth',
            yaxis_title='Number of Voters',
            autosize=True,
            height=450,
            margin=dict(l=80, r=80, t=60, b=80),
        )
        context['birth_year_graph'] = fig1.to_html(full_html=False, config={'responsive': True})

        # --- Chart 2: Party affiliation pie chart ---
        party_data = (
            qs.values('party_affiliation')
            .annotate(count=Count('id'))
            .order_by('party_affiliation')
        )
        party_labels = [d['party_affiliation'].strip() for d in party_data]
        party_counts = [d['count'] for d in party_data]

        # Build a shared color map so pie slices and minor-party bars use the same colors.
        plotly_colors = [
            '#636EFA', '#EF553B', '#00CC96', '#AB63FA', '#FFA15A',
            '#19D3F3', '#FF6692', '#B6E880', '#FF97FF', '#FECB52',
        ]
        color_map = {label: plotly_colors[i % len(plotly_colors)] for i, label in enumerate(party_labels)}
        pie_colors = [color_map[label] for label in party_labels]

        fig2 = go.Figure(data=[go.Pie(
            labels=party_labels,
            values=party_counts,
            textinfo='none',
            marker=dict(colors=pie_colors),
        )])
        fig2.update_layout(
            title='',
            autosize=True,
            height=850,
            paper_bgcolor='rgb(229,236,246)',
            font=dict(size=12),
            margin=dict(l=80, r=80, t=60, b=80),
            legend=dict(orientation='h', yanchor='bottom', y=1.02, xanchor='center', x=0.5),
        )
        fig2.add_annotation(
            text='Hover over slices to see exact statistics',
            xref='paper', yref='paper',
            x=1, y=0,
            xanchor='right', yanchor='bottom',
            showarrow=False,
            font=dict(size=10, color='gray'),
        )
        context['party_graph'] = fig2.to_html(full_html=False, config={'responsive': True})

        # --- Chart 2b: Minor party breakdown bar chart ---
        # Shows parties that fall below 1% of total voters, sorted by count descending.
        total = sum(party_counts)
        threshold = total * 0.01
        minor = sorted(
            [(label, count) for label, count in zip(party_labels, party_counts) if count < threshold],
            key=lambda x: x[1], reverse=True,
        )
        if minor:
            minor_labels, minor_counts = zip(*minor)
            minor_colors = [color_map[label] for label in minor_labels]
            fig2b = go.Figure(data=[go.Bar(
                x=list(minor_labels),
                y=list(minor_counts),
                marker_color=minor_colors,
            )])
            fig2b.update_layout(
                title='Minor Party Breakdown (< 1% of Total Voters)',
                xaxis_title='Party',
                yaxis_title='Number of Voters',
                autosize=True,
                height=350,
                paper_bgcolor='rgb(229,236,246)',
            )
            context['minor_party_graph'] = fig2b.to_html(full_html=False, config={'responsive': True})
        else:
            context['minor_party_graph'] = None

        # --- Chart 3: Election participation histogram ---
        election_fields = ['v20state', 'v21town', 'v21primary', 'v22general', 'v23town']
        election_labels = ['2020 State', '2021 Town', '2021 Primary', '2022 General', '2023 Town']
        election_counts = [qs.filter(**{field: True}).count() for field in election_fields]

        fig3 = go.Figure(data=[go.Bar(x=election_labels, y=election_counts)])
        fig3.update_layout(
            title='',
            xaxis_title='Election',
            yaxis_title='Number of Voters',
            autosize=True,
            height=450,
            margin=dict(l=80, r=80, t=60, b=80),
        )
        context['election_graph'] = fig3.to_html(full_html=False, config={'responsive': True})

        return context
