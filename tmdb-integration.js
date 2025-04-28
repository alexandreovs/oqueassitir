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

// Variável para armazenar todas as sugestões carregadas
let currentSuggestions = [];

// Função para formatar a duração em minutos para "Xh Ymin"
function formatRuntime(minutes) {
  if (!minutes || minutes <= 0) return 'Duração não informada';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

// Função para buscar detalhes completos do filme
async function fetchMovieDetails(movieId) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=pt-BR`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Erro ao buscar detalhes do filme ${movieId}: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar detalhes do filme:', error);
    return null;
  }
}

// Função principal para buscar sugestões - SEM LIMITE DE FILMES
async function fetchSuggestions(time, mood, streaming) {
  try {
    const genreId = moodToGenre[mood];
    if (!genreId) throw new Error('Humor não reconhecido');

    let url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}`;
    url += `&with_genres=${genreId}`;
    url += `&language=pt-BR`;
    url += `&sort_by=popularity.desc`;
    url += `&include_adult=false`;
    url += `&page=1`; // Pode aumentar para pegar mais resultados
    
    if (time <= 60) {
      url += `&with_runtime.lte=60`;
    } else if (time <= 120) {
      url += `&with_runtime.gte=61&with_runtime.lte=120`;
    } else {
      url += `&with_runtime.gte=121`;
    }
    
    if (streaming && streaming !== "") {
      const providerId = streamingProviders[streaming];
      if (providerId) {
        const watchRegions = await getWatchRegions(providerId);
        if (watchRegions.length > 0) {
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
    
    if (!data.results || data.results.length === 0) {
      throw new Error('Nenhum resultado encontrado');
    }

    // Buscar detalhes completos para todos os filmes retornados
    const detailedResults = await Promise.all(
      data.results.map(async movie => {
        const details = await fetchMovieDetails(movie.id);
        return details ? {...movie, runtime: details.runtime} : movie;
      })
    );
    
    // Armazenar todas as sugestões para uso posterior
    currentSuggestions = detailedResults;
    
    return processTMDBResults(detailedResults, streaming);
  } catch (error) {
    console.error('Erro detalhado ao buscar sugestões:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Processar os resultados do TMDB
function processTMDBResults(results, streaming) {
  return results
    .filter(movie => movie.poster_path && movie.title) // Filtro básico
    .map(movie => ({
      id: movie.id,
      title: movie.title,
      overview: movie.overview || 'Descrição não disponível',
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      runtime: movie.runtime || 0, // Usa 0 como fallback se não tiver runtime
      type: 'movie',
      streaming: streaming ? getStreamingName(streaming) : 'Vários streamings',
      vote_average: movie.vote_average
    }));
}

// Função para atualizar sugestão única
function updateSingleSuggestion(suggestion) {
  // Limpar avaliações anteriores primeiro
  const infoContainer = document.querySelector('#singleSuggestion .flex-1');
  const existingRating = infoContainer.querySelector('.rating-badge');
  if (existingRating) {
    existingRating.remove();
  }

  // Atualizar informações básicas
  document.getElementById('singleTitle').textContent = suggestion.title;
  
  // Mostrar duração formatada corretamente
  const durationText = formatRuntime(suggestion.runtime);
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

// Função para adicionar cards de sugestão - ATUALIZADA com melhor espaçamento
function addSuggestionCard(suggestion) {
  const card = document.createElement('div');
  card.className = 'suggestion-card bg-[#2d2d2d] rounded-xl overflow-hidden flex flex-col h-full transition-all hover:transform hover:-translate-y-1 hover:shadow-lg';
  
  // Mostrar duração formatada corretamente
  const durationText = formatRuntime(suggestion.runtime);
  
  const rating = suggestion.vote_average 
    ? `⭐ ${suggestion.vote_average.toFixed(1)}/10`
    : 'Sem avaliação';
  
  card.innerHTML = `
    <div class="aspect-[2/3] bg-gray-800 overflow-hidden">
      <img src="https://image.tmdb.org/t/p/w500${suggestion.poster_path}" 
           alt="Poster de ${suggestion.title}" 
           class="w-full h-full object-cover hover:opacity-90 transition-opacity">
    </div>
    <div class="p-4 flex-1 flex flex-col gap-3">
      <h3 class="text-lg font-bold line-clamp-2" style="min-height: 3rem;">${suggestion.title}</h3>
      <div class="flex flex-wrap items-center gap-2">
        <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded whitespace-nowrap">${durationText}</span>
        <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${suggestion.release_date?.substring(0, 4) || 'N/A'}</span>
        <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${rating}</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-gray-400 text-xs">Disponível em:</span>
        <span class="bg-[#E50914] px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">${suggestion.streaming}</span>
      </div>
      <button class="dislike-button mt-4 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white py-2 px-4 rounded-full transition-all text-sm w-full">
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
      
      // Verifica se temos sugestões disponíveis
      if (!currentSuggestions || currentSuggestions.length === 0) {
        currentSuggestions = await fetchSuggestions(selectedTime, selectedMood, selectedStreaming);
      }
      
      // Filtra sugestões já mostradas
      const shownTitles = Array.from(document.querySelectorAll('.suggestion-card h3')).map(el => el.textContent);
      const availableSuggestions = currentSuggestions.filter(
        s => !shownTitles.includes(s.title)
      );
      
      // Se não houver mais sugestões não mostradas, buscar novas
      if (availableSuggestions.length === 0) {
        currentSuggestions = await fetchSuggestions(selectedTime, selectedMood, selectedStreaming);
        availableSuggestions = [...currentSuggestions];
      }
      
      // Seleciona uma sugestão aleatória das disponíveis
      const newSuggestion = availableSuggestions[Math.floor(Math.random() * availableSuggestions.length)];
      
      // Atualizar o cartão com a nova sugestão
      const newDurationText = formatRuntime(newSuggestion.runtime);
      
      const newRating = newSuggestion.vote_average 
        ? `⭐ ${newSuggestion.vote_average.toFixed(1)}/10`
        : 'Sem avaliação';
      
      card.innerHTML = `
        <div class="aspect-[2/3] bg-gray-800 overflow-hidden">
          <img src="https://image.tmdb.org/t/p/w500${newSuggestion.poster_path}" 
               alt="Poster de ${newSuggestion.title}" 
               class="w-full h-full object-cover hover:opacity-90 transition-opacity">
        </div>
        <div class="p-4 flex-1 flex flex-col gap-3">
          <h3 class="text-lg font-bold line-clamp-2" style="min-height: 3rem;">${newSuggestion.title}</h3>
          <div class="flex flex-wrap items-center gap-2">
            <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded whitespace-nowrap">${newDurationText}</span>
            <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${newSuggestion.release_date?.substring(0, 4) || 'N/A'}</span>
            <span class="bg-[#3d3d3d] text-xs px-2 py-1 rounded">${newRating}</span>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-gray-400 text-xs">Disponível em:</span>
            <span class="bg-[#E50914] px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">${newSuggestion.streaming}</span>
          </div>
          <button class="dislike-button mt-4 bg-[#3d3d3d] hover:bg-[#4d4d4d] text-white py-2 px-4 rounded-full transition-all text-sm w-full">
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

// Função auxiliar para obter regiões onde um provider está disponível
async function getWatchRegions(providerId) {
  try {
    const url = `https://api.themoviedb.org/3/watch/providers/movie?api_key=${TMDB_API_KEY}&watch_region=BR`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results) {
      const provider = data.results.find(p => p.provider_id === providerId);
      return provider ? ['BR'] : [];
    }
    return [];
  } catch (error) {
    console.error('Erro ao buscar regiões:', error);
    return [];
  }
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

// Atualize o evento do botão principal para usar todas as sugestões
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
    
    // Buscar sugestões (sem limite)
    const suggestions = await fetchSuggestions(selectedTime, selectedMood, selectedStreaming);
    
    if (!suggestions || suggestions.length === 0) {
      alert('Não encontramos sugestões com esses critérios. Tente aumentar o tempo ou escolher outro humor.');
      return;
    }
    
    suggestionArea.classList.remove('hidden');
    const showSingle = Math.random() > 0.5 || suggestions.length === 1;
    
    if (showSingle) {
      singleSuggestion.classList.remove('hidden');
      multipleSuggestions.classList.add('hidden');
      
      const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
      updateSingleSuggestion(randomSuggestion);
      
      document.getElementById('dislikeSingle').onclick = async () => {
        if (isLoading) return;
        
        try {
          isLoading = true;
          document.getElementById('dislikeSingle').textContent = 'Carregando...';
          document.getElementById('dislikeSingle').disabled = true;
          
          // Usa as sugestões já carregadas primeiro
          if (!currentSuggestions || currentSuggestions.length === 0) {
            currentSuggestions = await fetchSuggestions(selectedTime, selectedMood, selectedStreaming);
          }
          
          const newRandomSuggestion = currentSuggestions[Math.floor(Math.random() * currentSuggestions.length)];
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
    } else {
      singleSuggestion.classList.add('hidden');
      multipleSuggestions.classList.remove('hidden');
      multipleSuggestions.querySelector('div').innerHTML = '';
      
      // Mostrar apenas 3 sugestões inicialmente, mas manter todas em currentSuggestions
      const initialSuggestions = suggestions.slice(0, 3);
      
      initialSuggestions.forEach(suggestion => {
        addSuggestionCard(suggestion);
      });
    }
    
    suggestionArea.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error('Erro completo:', {
      message: error.message,
      stack: error.stack
    });
    alert('Ocorreu um erro ao buscar sugestões. Por favor, tente novamente.');
  } finally {
    isLoading = false;
    surpriseButton.textContent = 'Me Surpreenda!';
    surpriseButton.disabled = false;
  }
});
