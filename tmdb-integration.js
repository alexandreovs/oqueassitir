// Substitua esta chave pela sua própria API Key do TMDB
const TMDB_API_KEY = '2231e5ebcde14fe8357dd71af683f89c';

// Mapeamento de humores para gêneros do TMDB
const moodToGenre = {
  'alegre': 35,    // Comédia
  'nervoso': 28,   // Ação
  'bizarro': 27,   // Terror
  'romântico': 10749, // Romance
  'inteligente': 878  // Ficção Científica
};

// Mapeamento de streaming para providers do TMDB
const streamingProviders = {
  'netflix': 8,
  'prime': 119,
  'disney': 337,
  'hbo': 384
};

// Função principal para buscar sugestões
async function fetchSuggestions(time, mood, streaming) {
  try {
    // Determinar o gênero baseado no humor
    const genreId = moodToGenre[mood];
    if (!genreId) throw new Error('Humor não reconhecido');

    // Construir a URL da API
    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}`;
    url += `&with_genres=${genreId}`;
    url += `&language=pt-BR`;
    url += `&sort_by=popularity.desc`;
    url += `&include_adult=false`;
    
    // Filtrar por tempo (duração aproximada)
    if (time <= 60) {
      url += `&with_runtime.lte=90`;
    } else if (time <= 120) {
      url += `&with_runtime.gte=60&with_runtime.lte=120`;
    } else {
      url += `&with_runtime.gte=120`;
    }
    
    // Se um streaming específico foi selecionado
    if (streaming && streaming !== "") {
      const providerId = streamingProviders[streaming];
      if (providerId) {
        // Primeiro precisamos verificar em quais regiões esse streaming está disponível
        const watchRegions = await getWatchRegions(providerId);
        
        if (watchRegions.length > 0) {
          // Pegamos a primeira região disponível (poderia implementar lógica para detectar região do usuário)
          url += `&watch_region=${watchRegions[0]}`;
          url += `&with_watch_providers=${providerId}`;
        }
      }
    }

    console.log('Fetching from TMDB:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Processar os resultados
    if (data.results && data.results.length > 0) {
      return processTMDBResults(data.results, streaming);
    } else {
      throw new Error('Nenhum resultado encontrado');
    }
  } catch (error) {
    console.error('Erro ao buscar sugestões:', error);
    throw error;
  }
}

// Função auxiliar para obter regiões onde um provider está disponível
async function getWatchRegions(providerId) {
  try {
    const url = `https://api.themoviedb.org/3/watch/providers/movie?api_key=${TMDB_API_KEY}&watch_region=BR`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results) {
      const provider = data.results.find(p => p.provider_id === providerId);
      return provider ? ['BR'] : []; // Simplificado - poderia buscar mais regiões
    }
    return [];
  } catch (error) {
    console.error('Erro ao buscar regiões:', error);
    return [];
  }
}

// Processar os resultados do TMDB para o formato que nosso site espera
function processTMDBResults(results, streaming) {
  return results.map(movie => ({
    id: movie.id,
    title: movie.title,
    overview: movie.overview || 'Descrição não disponível',
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    runtime: Math.floor(movie.runtime / 10) * 10 || 90, // Aproximar para dezenas
    type: 'movie',
    streaming: streaming ? getStreamingName(streaming) : 'Vários streamings',
    vote_average: movie.vote_average
  }));
}

// Obter o nome amigável do streaming
function getStreamingName(streamingCode) {
  const names = {
    'netflix': 'Netflix',
    'prime': 'Prime Video',
    'disney': 'Disney+',
    'hbo': 'HBO Max'
  };
  return names[streamingCode] || 'Vários streamings';
}

// Função corrigida para atualizar sugestão única
function updateSingleSuggestion(suggestion) {
  // Limpar avaliações anteriores primeiro
  const infoContainer = document.querySelector('#singleSuggestion .flex-1');
  const existingRating = infoContainer.querySelector('.rating-badge');
  if (existingRating) {
    existingRating.remove();
  }

  // Atualizar informações básicas
  document.getElementById('singleTitle').textContent = suggestion.title;
  
  // Format duration
  const durationText = suggestion.type === 'movie' 
    ? `${suggestion.runtime || 'N/A'} min` 
    : 'Série';
  document.getElementById('singleDuration').textContent = durationText;
  
  // Format year
  const year = suggestion.release_date 
    ? suggestion.release_date.substring(0, 4)
    : 'N/A';
  document.getElementById('singleYear').textContent = year;

  // Adicionar avaliação (se existir)
  if (suggestion.vote_average) {
    const rating = `⭐ ${suggestion.vote_average.toFixed(1)}/10`;
    const ratingBadge = document.createElement('span');
    ratingBadge.className = 'bg-[#3d3d3d] text-sm px-2 py-1 rounded rating-badge';
    ratingBadge.textContent = rating;
    document.getElementById('singleYear').insertAdjacentElement('afterend', ratingBadge);
  }

  // Restante das atualizações
  document.getElementById('singleDescription').textContent = suggestion.overview || 'Sem descrição disponível';
  document.getElementById('singleStreaming').textContent = suggestion.streaming || 'Não disponível em streaming';
  
  const posterUrl = suggestion.poster_path 
    ? `https://image.tmdb.org/t/p/w500${suggestion.poster_path}`
    : 'https://via.placeholder.com/500x750?text=Sem+Poster';
  document.getElementById('singlePoster').src = posterUrl;
  document.getElementById('singlePoster').alt = `Poster de ${suggestion.title}`;
}

// Modificar a função addSuggestionCard para incluir avaliação
function addSuggestionCard(suggestion) {
  const card = document.createElement('div');
  card.className = 'suggestion-card bg-[#2d2d2d] rounded-xl overflow-hidden flex flex-col h-full';
  
  const rating = suggestion.vote_average 
    ? `⭐ ${suggestion.vote_average.toFixed(1)}/10`
    : 'Sem avaliação';
  
  card.innerHTML = `
    <div class="aspect-[2/3] bg-gray-800 overflow-hidden">
      <img src="https://image.tmdb.org/t/p/w500${suggestion.poster_path}" 
           alt="Poster de ${suggestion.title}" 
           class="w-full h-full object-cover">
    </div>
    <div class="p-4 flex-1 flex flex-col">
      <h3 class="text-xl font-bold mb-2">${suggestion.title}</h3>
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${suggestion.runtime || 'N/A'} min</span>
        <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${suggestion.release_date?.substring(0, 4) || 'N/A'}</span>
        <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${rating}</span>
      </div>
      <div class="flex items-center gap-2 mb-3">
        <span class="text-gray-400 text-sm">Disponível em:</span>
        <span class="bg-[#E50914] px-2 py-1 rounded-full text-xs font-medium">${suggestion.streaming}</span>
      </div>
      <button class="dislike-button mt-auto bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white py-2 px-4 rounded-full transition-all text-sm">
        Não gostei! Me dê outra
      </button>
    </div>
  `;
  
  multipleSuggestions.querySelector('div').appendChild(card);
  
  // Configurar o botão de "Não gostei"
  const dislikeButton = card.querySelector('.dislike-button');
  dislikeButton.addEventListener('click', async function() {
    if (isLoading) return;
    
    try {
      isLoading = true;
      this.textContent = 'Carregando...';
      this.disabled = true;
      
      const newSuggestions = await fetchSuggestions(selectedTime, selectedMood, selectedStreaming);
      
      if (!newSuggestions || newSuggestions.length === 0) {
        alert('Não temos mais sugestões com esses critérios. Tente outros filtros!');
        return;
      }
      
      // Substituir o cartão atual por um novo
      const newSuggestion = newSuggestions[Math.floor(Math.random() * newSuggestions.length)];
      card.innerHTML = `
        <div class="aspect-[2/3] bg-gray-800 overflow-hidden">
          <img src="https://image.tmdb.org/t/p/w500${newSuggestion.poster_path}" 
               alt="Poster de ${newSuggestion.title}" 
               class="w-full h-full object-cover">
        </div>
        <div class="p-4 flex-1 flex flex-col">
          <h3 class="text-xl font-bold mb-2">${newSuggestion.title}</h3>
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${newSuggestion.runtime || 'N/A'} min</span>
            <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${newSuggestion.release_date?.substring(0, 4) || 'N/A'}</span>
            <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">⭐ ${newSuggestion.vote_average?.toFixed(1) || 'N/A'}/10</span>
          </div>
          <div class="flex items-center gap-2 mb-3">
            <span class="text-gray-400 text-sm">Disponível em:</span>
            <span class="bg-[#E50914] px-2 py-1 rounded-full text-xs font-medium">${newSuggestion.streaming}</span>
          </div>
          <button class="dislike-button mt-auto bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white py-2 px-4 rounded-full transition-all text-sm">
            Não gostei! Me dê outra
          </button>
        </div>
      `;
      
      // Reconfigurar o evento para o novo botão
      const newDislikeButton = card.querySelector('.dislike-button');
      newDislikeButton.addEventListener('click', dislikeButton.click.bind(dislikeButton));
      
    } catch (error) {
      console.error('Erro ao buscar nova sugestão:', error);
      alert('Ocorreu um erro ao buscar nova sugestão.');
    } finally {
      isLoading = false;
      this.textContent = 'Não gostei! Me dê outra';
      this.disabled = false;
    }
  });
}

// Substituir a função fetchSuggestions original no evento de clique
surpriseButton.addEventListener('click', async () => {
  if (!selectedTime) {
    alert('Por favor, selecione um tempo disponível!');
    return;
  }
  
  if (!selectedMood) {
    alert('Por favor, selecione seu humor!');
    return;
  }
  
  if (isLoading) return;
  
  try {
    isLoading = true;
    surpriseButton.textContent = 'Carregando...';
    surpriseButton.disabled = true;
    
    // Usar a nova função fetchSuggestions com TMDB
    const suggestions = await fetchSuggestions(selectedTime, selectedMood, selectedStreaming);
    
    if (!suggestions || suggestions.length === 0) {
      alert('Não encontramos sugestões com esses critérios. Tente aumentar o tempo ou escolher outro humor.');
      return;
    }
    
    // Mostrar área de sugestões
    suggestionArea.classList.remove('hidden');
    singleSuggestion.classList.remove('hidden');
    multipleSuggestions.classList.add('hidden');
    
    // Mostrar uma sugestão aleatória
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    updateSingleSuggestion(randomSuggestion);
    
    // Configurar o botão "Não gostei"
    document.getElementById('dislikeSingle').onclick = async () => {
      if (isLoading) return;
      
      try {
        isLoading = true;
        document.getElementById('dislikeSingle').textContent = 'Carregando...';
        document.getElementById('dislikeSingle').disabled = true;
        
        const newSuggestions = await fetchSuggestions(selectedTime, selectedMood, selectedStreaming);
        
        if (!newSuggestions || newSuggestions.length === 0) {
          alert('Não temos mais sugestões com esses critérios. Tente outros filtros!');
          return;
        }
        
        const newRandomSuggestion = newSuggestions[Math.floor(Math.random() * newSuggestions.length)];
        updateSingleSuggestion(newRandomSuggestion);
        
      } catch (error) {
        console.error('Erro ao buscar nova sugestão:', error);
        alert('Ocorreu um erro ao buscar nova sugestão.');
      } finally {
        isLoading = false;
        document.getElementById('dislikeSingle').textContent = 'Não gostei! Me dê outra';
        document.getElementById('dislikeSingle').disabled = false;
      }
    };
    
    // Rolagem suave para as sugestões
    suggestionArea.scrollIntoView({ behavior: 'smooth' });
    
  } catch (error) {
    console.error('Erro ao buscar sugestões:', error);
    alert('Ocorreu um erro ao buscar sugestões. Por favor, tente novamente.');
  } finally {
    isLoading = false;
    surpriseButton.textContent = 'Me Surpreenda!';
    surpriseButton.disabled = false;
  }
});
